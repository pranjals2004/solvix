import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { loadConfig } from './config/env';
import { createPool } from './db/pool';
import { PostgresDoubtRepository } from './db/doubt-repository';
import { MlServiceEmbeddingClient } from './content/embedding-client';
import { S3PrivateObjectStorage } from './doubts/storage';
import { createLLMProvider } from './doubts/llm-provider';
import { DoubtResolver } from './doubts/resolver';
import { DOUBT_QUEUE_NAME } from './doubts/queue';
import { RedisDoubtEmitter } from './realtime/redis-emitter';
import { PostgresLeaderboardRepository } from './db/leaderboard-repository';
import { RedisLeaderboardService } from './leaderboard/service';
import { BullLeaderboardQueue, LEADERBOARD_QUEUE_NAME } from './leaderboard/queue';
import { weekStartFor } from './leaderboard/week';
import { IoredisService } from './infra/redis';
import { randomUUID } from 'node:crypto';
import { PostgresMisconceptionRepository } from './db/misconception-repository';
import { MISCONCEPTION_QUEUE_NAME, BullMisconceptionQueue } from './misconceptions/queue';
import { MlServiceClusteringClient } from './misconceptions/ml-client';
import { MisconceptionClusteringService } from './misconceptions/service';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function startWorker() {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  const repository = new PostgresDoubtRepository(pool);
  const emitter = new RedisDoubtEmitter(config.redisUrl);
  const leaderboardRedis = new IoredisService(config.redisUrl);
  await leaderboardRedis.connect();
  const leaderboardService = new RedisLeaderboardService(
    new PostgresLeaderboardRepository(pool),
    leaderboardRedis,
    config.leaderboardTimezone ?? 'Asia/Kolkata',
  );
  const resolver = new DoubtResolver(
    repository,
    new MlServiceEmbeddingClient(config.mlServiceUrl),
    createLLMProvider(config),
    new S3PrivateObjectStorage(config),
    emitter,
  );
  const worker = new Worker<{ doubtId: string }>(
    DOUBT_QUEUE_NAME,
    async (job) => resolver.resolve(job.data.doubtId),
    { connection: new Redis(config.redisUrl, { maxRetriesPerRequest: null }) },
  );
  const archiveQueue = new BullLeaderboardQueue(config.redisUrl);
  await archiveQueue.scheduleWeeklyArchive(config.leaderboardTimezone ?? 'Asia/Kolkata');
  const misconceptionQueue = new BullMisconceptionQueue(config.redisUrl);
  await misconceptionQueue.scheduleWeekly(config.leaderboardTimezone ?? 'Asia/Kolkata');
  const misconceptionService = new MisconceptionClusteringService(
    new PostgresMisconceptionRepository(pool),
    new MlServiceClusteringClient(config.mlServiceUrl),
  );
  const archiveWorker = new Worker(
    LEADERBOARD_QUEUE_NAME,
    async (job) => {
      if (job.name !== 'archive-week') return;
      const scheduledAt = job.opts.prevMillis ?? job.timestamp;
      const weekStart = weekStartFor(
        new Date(scheduledAt),
        config.leaderboardTimezone ?? 'Asia/Kolkata',
      );
      await leaderboardService.finalizeWeek(weekStart);
    },
    { connection: new Redis(config.redisUrl, { maxRetriesPerRequest: null }) },
  );
  const misconceptionWorker = new Worker<{ runId?: string }>(
    MISCONCEPTION_QUEUE_NAME,
    async (job) => {
      const runId = job.data.runId ?? randomUUID();
      const result = await misconceptionService.run(runId);
      process.stdout.write(
        `Misconception run ${result.runId} processed ${result.doubtsProcessed} doubts across ${result.topicsProcessed} topics.\n`,
      );
      return result;
    },
    { connection: new Redis(config.redisUrl, { maxRetriesPerRequest: null }), concurrency: 1 },
  );
  archiveWorker.on('error', (error) =>
    process.stderr.write(`Leaderboard archive worker error: ${error.message}\n`),
  );
  archiveWorker.on('failed', (job, error) => {
    process.stderr.write(`Leaderboard archive ${job?.id ?? 'unknown'} failed: ${error.message}\n`);
  });
  archiveWorker.on('ready', () =>
    process.stdout.write('Solvix leaderboard archive schedule is ready.\n'),
  );
  misconceptionWorker.on('failed', (job, error) => {
    process.stderr.write(
      `Misconception clustering ${job?.id ?? 'unknown'} failed: ${error.message}\n`,
    );
  });
  misconceptionWorker.on('error', (error) =>
    process.stderr.write(`Misconception worker error: ${error.message}\n`),
  );
  misconceptionWorker.on('ready', () =>
    process.stdout.write('Solvix misconception schedule is ready.\n'),
  );
  worker.on('failed', (job, error) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    process.stderr.write(
      `Doubt job ${job.id ?? job.data.doubtId} exhausted retries: ${error.message}\n`,
    );
    void resolver.fail(job.data.doubtId);
  });
  worker.on('ready', () => process.stdout.write('Solvix doubt worker is ready.\n'));
  worker.on('error', (error) => process.stderr.write(`Doubt worker error: ${error.message}\n`));

  const shutdown = async (signal: string) => {
    process.stdout.write(`Received ${signal}; closing doubt worker.\n`);
    await Promise.allSettled([
      worker.close(),
      archiveWorker.close(),
      misconceptionWorker.close(),
      archiveQueue.close(),
      misconceptionQueue.close(),
      pool.end(),
      emitter.close(),
      leaderboardRedis.close(),
    ]);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void startWorker().catch((error: unknown) => {
  process.stderr.write(`Solvix doubt worker startup failed: ${String(error)}\n`);
  process.exitCode = 1;
});
