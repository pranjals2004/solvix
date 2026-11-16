import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { loadConfig } from '../config/env';
import { createPool } from './pool';

dotenv.config({ path: resolve(__dirname, '../../../../.env') });

async function migrate() {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  const client = await pool.connect();
  const migrationsDirectory = resolve(__dirname, 'migrations');

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const alreadyApplied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [file],
      );
      if (alreadyApplied.rowCount) continue;

      const sql = await readFile(resolve(migrationsDirectory, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        process.stdout.write(`Applied ${file}\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    if (files.length === 0) process.stdout.write('No pending migrations.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

void migrate().catch((error: unknown) => {
  process.stderr.write(`Migration failed: ${String(error)}\n`);
  process.exitCode = 1;
});
