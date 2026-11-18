import type { Pool } from 'pg';
import { gradeAnswer } from '../practice/grading';
import { calculateElo } from '../practice/elo';
import type { AppConfig } from '../config/env';
import type { ExperimentArm } from '../domain/user';
import type { SubmissionInput, SubmissionRepository, SubmissionResult } from '../practice/types';
import {
  isRankableCorrectAttempt,
  SUBTHRESHOLD_FLAG_COUNT,
  SUBTHRESHOLD_FLAG_WINDOW_MINUTES,
  weekStartFor,
} from '../leaderboard/week';

type QuestionRow = {
  id: string;
  type: 'mcq' | 'msq' | 'nat';
  correct_answer_json: unknown;
  nat_tolerance: number | string | null;
  solution_latex: string;
  topic_id: string;
};
type AttemptRow = { attempt_no: number };
type NewSubmissionRow = { id: string; created_at: Date };
type RatingRow = { rating: number | string };

export class PostgresSubmissionRepository implements SubmissionRepository {
  constructor(
    private readonly pool: Pool,
    private readonly leaderboardTimezone = 'Asia/Kolkata',
    private readonly config: Pick<
      AppConfig,
      'eloK' | 'eloGamma' | 'eloWeightingVariant' | 'eloAlpha' | 'eloBeta'
    > = {},
  ) {}

  async submit(
    userId: string,
    arm: ExperimentArm,
    input: SubmissionInput,
  ): Promise<SubmissionResult | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Locking the question serializes attempt-number assignment for this question.
      const questionResult = await client.query<QuestionRow>(
        `SELECT id, topic_id, type, correct_answer_json, nat_tolerance, solution_latex
         FROM questions WHERE id = $1 FOR UPDATE`,
        [input.questionId],
      );
      const question = questionResult.rows[0];
      if (!question) {
        await client.query('ROLLBACK');
        return null;
      }

      const attemptResult = await client.query<AttemptRow>(
        `SELECT COALESCE(MAX(attempt_no), 0) + 1 AS attempt_no
         FROM submissions WHERE user_id = $1 AND question_id = $2`,
        [userId, input.questionId],
      );
      const attemptNo = attemptResult.rows[0]?.attempt_no ?? 1;
      const isCorrect = gradeAnswer(
        question.type,
        input.answer,
        question.correct_answer_json,
        question.nat_tolerance === null ? null : Number(question.nat_tolerance),
      );

      const submissionResult = await client.query<NewSubmissionRow>(
        `INSERT INTO submissions
          (user_id, question_id, is_correct, time_taken_sec, confidence_raw, attempt_no, counted_for_rank)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         RETURNING id, created_at`,
        [userId, input.questionId, isCorrect, input.timeTakenSec, input.confidence, attemptNo],
      );
      const submission = submissionResult.rows[0];
      if (!submission) throw new Error('Submission insert returned no row.');

      await client.query(
        `INSERT INTO user_skill_estimate (user_id, topic_id) VALUES ($1, $2)
         ON CONFLICT (user_id, topic_id) DO NOTHING`,
        [userId, question.topic_id],
      );
      const skillResult = await client.query<RatingRow>(
        'SELECT rating FROM user_skill_estimate WHERE user_id = $1 AND topic_id = $2 FOR UPDATE',
        [userId, question.topic_id],
      );
      await client.query(
        `INSERT INTO question_difficulty_estimate (question_id, rating)
         SELECT id, difficulty_rating FROM questions WHERE id = $1
         ON CONFLICT (question_id) DO NOTHING`,
        [question.id],
      );
      const questionRatingResult = await client.query<RatingRow>(
        'SELECT rating FROM question_difficulty_estimate WHERE question_id = $1 FOR UPDATE',
        [question.id],
      );
      const skillBefore = Number(skillResult.rows[0]?.rating ?? 1000);
      const questionBefore = Number(questionRatingResult.rows[0]?.rating ?? 1000);
      // Random-arm ratings are logged with standard Elo for evaluation, but never drive selection.
      const rating = calculateElo(
        {
          skillRating: skillBefore,
          questionRating: questionBefore,
          outcome: isCorrect ? 1 : 0,
          confidence: input.confidence,
          arm: arm === 'conf_elo' ? arm : 'standard_elo',
        },
        {
          k: this.config.eloK,
          gamma: this.config.eloGamma,
          weightingVariant: this.config.eloWeightingVariant,
          alpha: this.config.eloAlpha,
          beta: this.config.eloBeta,
        },
      );
      await client.query(
        'UPDATE user_skill_estimate SET rating = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND topic_id = $2',
        [userId, question.topic_id, rating.skillAfter],
      );
      await client.query(
        'UPDATE question_difficulty_estimate SET rating = $2, updated_at = CURRENT_TIMESTAMP WHERE question_id = $1',
        [question.id, rating.questionAfter],
      );
      await client.query(
        `INSERT INTO rating_events
          (user_id, question_id, rs_before, rs_after, rq_before, rq_after, k_eff, expected, outcome, confidence, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          userId,
          question.id,
          rating.skillBefore,
          rating.skillAfter,
          rating.questionBefore,
          rating.questionAfter,
          rating.kEffective,
          rating.expected,
          Number(isCorrect),
          input.confidence,
          submission.created_at,
        ],
      );
      await this.updateResurfaceQueue(
        client,
        userId,
        question.id,
        isCorrect,
        submission.created_at,
      );

      let countedForRank = false;
      let leaderboardWeekStart: string | null = null;
      let rankExclusionReason: SubmissionResult['rankExclusionReason'] = isCorrect
        ? null
        : 'incorrect';
      if (isRankableCorrectAttempt(isCorrect, input.timeTakenSec)) {
        leaderboardWeekStart = weekStartFor(submission.created_at, this.leaderboardTimezone);
        const claimedQuestion = await client.query(
          `INSERT INTO leaderboard_weekly_questions
             (week_start, user_id, question_id, submission_id, first_correct_at)
           VALUES ($1::date, $2, $3, $4, $5)
           ON CONFLICT (week_start, user_id, question_id) DO NOTHING
           RETURNING question_id`,
          [leaderboardWeekStart, userId, input.questionId, submission.id, submission.created_at],
        );
        countedForRank = claimedQuestion.rows.length > 0;
        if (countedForRank) {
          await client.query('UPDATE submissions SET counted_for_rank = true WHERE id = $1', [
            submission.id,
          ]);
        } else {
          leaderboardWeekStart = null;
          rankExclusionReason = 'already_counted';
        }
      } else if (isCorrect) {
        rankExclusionReason = 'too_fast';
      }

      if (input.timeTakenSec < 10) {
        await client.query(
          `UPDATE users SET is_flagged = true
           WHERE id = $1 AND (
             SELECT COUNT(*) FROM submissions
             WHERE user_id = $1 AND time_taken_sec < 10
               AND created_at >= CURRENT_TIMESTAMP - ($2::integer * INTERVAL '1 minute')
           ) >= $3`,
          [userId, SUBTHRESHOLD_FLAG_WINDOW_MINUTES, SUBTHRESHOLD_FLAG_COUNT],
        );
      }
      await client.query('UPDATE questions SET attempt_count = attempt_count + 1 WHERE id = $1', [
        input.questionId,
      ]);
      await client.query('COMMIT');
      return {
        isCorrect,
        solutionLatex: question.solution_latex,
        correctAnswer: question.correct_answer_json,
        attemptNo,
        countedForRank,
        leaderboardWeekStart,
        rankExclusionReason,
        skillRatingBefore: rating.skillBefore,
        skillRatingAfter: rating.skillAfter,
        questionRatingBefore: rating.questionBefore,
        questionRatingAfter: rating.questionAfter,
        expected: rating.expected,
        kEffective: rating.kEffective,
      };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original database error.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateResurfaceQueue(
    client: import('pg').PoolClient,
    userId: string,
    questionId: string,
    isCorrect: boolean,
    answeredAt: Date,
  ): Promise<void> {
    if (!isCorrect) {
      await client.query(
        `INSERT INTO resurface_queue (user_id, question_id, due_at, interval_days, stage)
         VALUES ($1, $2, $3::timestamptz + INTERVAL '1 day', 1, 0)
         ON CONFLICT (user_id, question_id) DO UPDATE
         SET due_at = EXCLUDED.due_at, interval_days = 1, stage = 0, last_presented_at = NULL`,
        [userId, questionId, answeredAt],
      );
      return;
    }
    await client.query(
      `UPDATE resurface_queue
       SET stage = LEAST(stage + 1, 3),
           interval_days = CASE LEAST(stage + 1, 3) WHEN 1 THEN 3 WHEN 2 THEN 7 ELSE 14 END,
           due_at = $3::timestamptz + (CASE LEAST(stage + 1, 3) WHEN 1 THEN 3 WHEN 2 THEN 7 ELSE 14 END * INTERVAL '1 day'),
           last_presented_at = NULL
       WHERE user_id = $1 AND question_id = $2 AND due_at <= $3`,
      [userId, questionId, answeredAt],
    );
  }
}
