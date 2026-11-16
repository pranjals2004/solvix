import type { Pool } from 'pg';
import { gradeAnswer } from '../practice/grading';
import type { SubmissionInput, SubmissionRepository, SubmissionResult } from '../practice/types';

type QuestionRow = {
  id: string;
  type: 'mcq' | 'msq' | 'nat';
  correct_answer_json: unknown;
  nat_tolerance: number | string | null;
  solution_latex: string;
};
type AttemptRow = { attempt_no: number };

export class PostgresSubmissionRepository implements SubmissionRepository {
  constructor(private readonly pool: Pool) {}

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

      await client.query(
        `INSERT INTO submissions
          (user_id, question_id, is_correct, time_taken_sec, confidence_raw, attempt_no, counted_for_rank)
         VALUES ($1, $2, $3, $4, $5, $6, false)`,
        [userId, input.questionId, isCorrect, input.timeTakenSec, input.confidence, attemptNo],
      );
      await client.query('UPDATE questions SET attempt_count = attempt_count + 1 WHERE id = $1', [input.questionId]);
      await client.query('COMMIT');
      return { isCorrect, solutionLatex: question.solution_latex, attemptNo };
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
