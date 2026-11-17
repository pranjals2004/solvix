import type { Pool, PoolClient } from 'pg';
import type { PrivacyRepository } from '../privacy/types';

export class PostgresPrivacyRepository implements PrivacyRepository {
  constructor(private readonly pool: Pool) {}

  async exportUserData(userId: string): Promise<Record<string, unknown> | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const user = await client.query(
        `SELECT id, name, email, role, arm, created_at, consent_given_at, is_flagged
         FROM users WHERE id = $1`, [userId],
      );
      if (!user.rows[0]) {
        await client.query('COMMIT');
        return null;
      }
      const data: Record<string, unknown> = { user: user.rows[0] };
      const queries: Array<[string, string]> = [
        ['submissions', 'SELECT question_id, is_correct, time_taken_sec, confidence_raw, attempt_no, counted_for_rank, created_at FROM submissions WHERE user_id = $1 ORDER BY created_at'],
        ['topicSkillEstimates', 'SELECT topic_id, rating, updated_at FROM user_skill_estimate WHERE user_id = $1 ORDER BY topic_id'],
        ['ratingEvents', 'SELECT question_id, rs_before, rs_after, rq_before, rq_after, k_eff, expected, outcome, confidence, created_at FROM rating_events WHERE user_id = $1 ORDER BY created_at'],
        ['doubts', 'SELECT id, question_id, text, image_key, status, conversation_json, ai_response, retrieval_context_json, error, created_at, completed_at FROM doubt_queries WHERE user_id = $1 ORDER BY created_at'],
        ['doubtFeedback', 'SELECT doubt_id, helpful, created_at FROM doubt_feedback WHERE user_id = $1 ORDER BY created_at'],
        ['resurfacingSchedule', 'SELECT question_id, due_at, interval_days, stage, last_presented_at FROM resurface_queue WHERE user_id = $1 ORDER BY due_at'],
        ['leaderboardArchive', 'SELECT week_start, solved_count, rank, archived_at FROM leaderboard_archive WHERE user_id = $1 ORDER BY week_start'],
        ['peerThreads', 'SELECT id, question_id, subject_id, topic_id, title, body, is_anonymous, created_at, updated_at FROM peer_doubt_threads WHERE user_id = $1 ORDER BY created_at'],
        ['peerReplies', 'SELECT id, thread_id, body, created_at FROM peer_doubt_replies WHERE user_id = $1 ORDER BY created_at'],
      ];
      for (const [key, sql] of queries) {
        const result = await client.query(sql, [userId]);
        data[key] = result.rows;
      }
      await client.query('COMMIT');
      return data;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async userExists(userId: string): Promise<boolean> {
    const result = await this.pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
    return result.rowCount === 1;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM users WHERE id = $1', [userId]);
    return result.rowCount === 1;
  }
}

async function rollback(client: PoolClient): Promise<void> {
  await client.query('ROLLBACK').catch(() => undefined);
}
