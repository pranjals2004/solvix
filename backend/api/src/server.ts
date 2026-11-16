import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { createApp } from './app';
import { loadConfig } from './config/env';
import { PostgresAuthRepository } from './db/auth-repository';
import { createPool } from './db/pool';
import { IoredisService } from './infra/redis';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function start() {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  const redis = new IoredisService(config.redisUrl);
  let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;

  try {
    if (config.nodeEnv !== 'test') await redis.connect();
    const app = createApp({ repository: new PostgresAuthRepository(pool), redis, config });
    server = app.listen(config.port, () => {
      process.stdout.write(`Solvix API listening on port ${config.port}\n`);
    });
  } catch (error) {
    process.stderr.write(`Solvix API startup failed: ${String(error)}\n`);
    await Promise.allSettled([pool.end(), redis.close()]);
    process.exitCode = 1;
    return;
  }

  const shutdown = (signal: string) => {
    process.stdout.write(`Received ${signal}; closing services.\n`);
    server?.close(() => {
      void Promise.allSettled([pool.end(), redis.close()]);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void start().catch((error: unknown) => {
  process.stderr.write(`Solvix API startup failed: ${String(error)}\n`);
  process.exitCode = 1;
});
