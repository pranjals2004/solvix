import type { Pool } from 'pg';
import { gradeAnswer } from '../practice/grading';
import type { SubmissionInput, SubmissionRepository, SubmissionResult } from '../practice/types';
import {
  isRankableCorrectAttempt, SUBTHRESHOLD_FLAG_COUNT, SUBTHRESHOLD_FLAG_WINDOW_MINUTES, weekStartFor,
} from '../leaderboard/week';

type QuestionRow = {
  id: string;
  type: 'mcq' | 'msq' | 'nat';
  correct_answer_json: unknown;
  nat_tolerance: number | string | null;
  solution_latex: string;
};
type AttemptRow = { attempt_no: number };
type NewSubmissionRow = { id: string; created_at: Date };

export class PostgresSubmissionRepository implements SubmissionRepository {
  constructor(private readonly pool: Pool, private readonly leaderboardTimezone = 'Asia/Kolkata') {}

  async submit(userId: string, input: SubmissionInput): Promise<SubmissionResult | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Locking the question serializes attempt-number assignment for this question.
      const questionResult = await client.query<QuestionRow>(
        `SELECT id, type, correct_answer_json, nat_tolerance, solution_latex
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

      let countedForRank = false;
      let leaderboardWeekStart: string | null = null;
      let rankExclusionReason: SubmissionResult['rankExclusionReason'] = isCorrect ? null : 'incorrect';
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
          await client.query('UPDATE submissions SET counted_for_rank = true WHERE id = $1', [submission.id]);
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
      await client.query('UPDATE questions SET attempt_count = attempt_count + 1 WHERE id = $1', [input.questionId]);
      await client.query('COMMIT');
      return {
        isCorrect,
        solutionLatex: question.solution_latex,
        attemptNo,
        countedForRank,
        leaderboardWeekStart,
        rankExclusionReason,
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
}
