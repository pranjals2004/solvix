import type { Pool } from 'pg';
import type { ArchivedLeaderboardEntry, FlaggedAccount, LeaderboardRepository, WeeklyLeaderboardRecord } from '../leaderboard/types';

type WeekRow = { user_id: string; name: string; solved_count: number | string; reached_count_at: Date };
type ArchiveRow = { user_id: string; name: string; solved_count: number | string; rank: number };

function mapWeek(row: WeekRow): WeeklyLeaderboardRecord {
  return {
    userId: row.user_id,
    name: row.name,
    solvedCount: Number(row.solved_count),
    reachedCountAt: row.reached_count_at,
  };
}

function mapArchive(row: ArchiveRow): ArchivedLeaderboardEntry {
  return {
    userId: row.user_id,
    name: row.name,
    solvedCount: Number(row.solved_count),
    rank: row.rank,
  };
}

export class PostgresLeaderboardRepository implements LeaderboardRepository {
  constructor(private readonly pool: Pool) {}

  async listWeek(weekStart: string): Promise<WeeklyLeaderboardRecord[]> {
    const result = await this.pool.query<WeekRow>(
      `SELECT w.user_id, u.name, COUNT(*)::integer AS solved_count,
         MAX(w.first_correct_at) AS reached_count_at
       FROM leaderboard_weekly_questions w
       JOIN users u ON u.id = w.user_id
       WHERE w.week_start = $1::date
       GROUP BY w.user_id, u.name
       ORDER BY COUNT(*) DESC, MAX(w.first_correct_at) ASC, w.user_id DESC`,
      [weekStart],
    );
    return result.rows.map(mapWeek);
  }

  async getUserWeek(userId: string, weekStart: string): Promise<WeeklyLeaderboardRecord | null> {
    const result = await this.pool.query<WeekRow>(
      `SELECT w.user_id, u.name, COUNT(*)::integer AS solved_count,
         MAX(w.first_correct_at) AS reached_count_at
       FROM leaderboard_weekly_questions w
       JOIN users u ON u.id = w.user_id
       WHERE w.week_start = $1::date AND w.user_id = $2
       GROUP BY w.user_id, u.name`,
      [weekStart, userId],
    );
    return result.rows[0] ? mapWeek(result.rows[0]) : null;
  }

  async archiveWeek(
    weekStart: string,
    entries: Array<{ userId: string; solvedCount: number; rank: number }>,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const entry of entries) {
        await client.query(
          `INSERT INTO leaderboard_archive (week_start, user_id, solved_count, rank)
           VALUES ($1::date, $2, $3, $4)
           ON CONFLICT (week_start, user_id) DO UPDATE SET
             solved_count = EXCLUDED.solved_count, rank = EXCLUDED.rank, archived_at = CURRENT_TIMESTAMP`,
          [weekStart, entry.userId, entry.solvedCount, entry.rank],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async listArchive(weekStart: string, limit: number): Promise<ArchivedLeaderboardEntry[]> {
    const result = await this.pool.query<ArchiveRow>(
      `SELECT a.user_id, u.name, a.solved_count, a.rank
       FROM leaderboard_archive a JOIN users u ON u.id = a.user_id
       WHERE a.week_start = $1::date
       ORDER BY a.rank ASC LIMIT $2`,
      [weekStart, limit],
    );
    return result.rows.map(mapArchive);
  }

  async getUserArchiveRank(userId: string, weekStart: string): Promise<ArchivedLeaderboardEntry | null> {
    const result = await this.pool.query<ArchiveRow>(
      `SELECT a.user_id, u.name, a.solved_count, a.rank
       FROM leaderboard_archive a JOIN users u ON u.id = a.user_id
       WHERE a.week_start = $1::date AND a.user_id = $2`,
      [weekStart, userId],
    );
    return result.rows[0] ? mapArchive(result.rows[0]) : null;
  }

  async listFlaggedUsers(limit: number): Promise<FlaggedAccount[]> {
    const result = await this.pool.query<{ id: string; name: string; email: string; flagged_at: Date }>(
      `SELECT u.id, u.name, u.email,
         COALESCE((
           SELECT MAX(s.created_at) FROM submissions s
           WHERE s.user_id = u.id AND s.time_taken_sec < 10
         ), u.created_at) AS flagged_at
       FROM users u WHERE u.is_flagged = true
       ORDER BY flagged_at DESC, u.id LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      userId: row.id, name: row.name, email: row.email, flaggedAt: row.flagged_at,
    }));
  }
}
