import type { Pool, PoolClient } from 'pg';
import type { AuthRepository, ExperimentArm, UserRecord, UserRole } from '../domain/user';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  arm: ExperimentArm;
  created_at: Date;
  is_flagged: boolean;
  password_hash?: string;
};

function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    arm: row.arm,
    createdAt: row.created_at,
    isFlagged: row.is_flagged,
  };
}

const userColumns = 'id, name, email, role, arm, created_at, is_flagged';

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly pool: Pool) {}

  async createStudent(input: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<UserRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [742_116]);
      const counts = await client.query<{ arm: ExperimentArm; count: string }>(
        'SELECT arm, COUNT(*)::text AS count FROM users GROUP BY arm',
      );
      const arms: ExperimentArm[] = ['random', 'standard_elo', 'conf_elo'];
      const currentCounts = new Map(counts.rows.map((row) => [row.arm, Number(row.count)]));
      const arm = arms.reduce((leastUsed, candidate) =>
        (currentCounts.get(candidate) ?? 0) < (currentCounts.get(leastUsed) ?? 0)
          ? candidate
          : leastUsed,
      );
      const result = await client.query<UserRow>(
        `INSERT INTO users (name, email, password_hash, consent_given_at, arm)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
         RETURNING ${userColumns}`,
        [input.name, input.email, input.passwordHash, arm],
      );
      const inserted = result.rows[0];
      if (!inserted) throw new Error('The database did not return the created account.');
      await client.query('COMMIT');
      return toUser(inserted);
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async findByEmail(email: string): Promise<(UserRecord & { passwordHash: string }) | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT ${userColumns}, password_hash FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
    const row = result.rows[0];
    return row?.password_hash ? { ...toUser(row), passwordHash: row.password_hash } : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT ${userColumns} FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toUser(result.rows[0]) : null;
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Keep the original database error; the connection is released in finally.
  }
}
