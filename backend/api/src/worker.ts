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

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function startWorker() {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  const repository = new PostgresDoubtRepository(pool);
  const emitter = new RedisDoubtEmitter(config.redisUrl);
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
  worker.on('failed', (job, error) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    process.stderr.write(`Doubt job ${job.id ?? job.data.doubtId} exhausted retries: ${error.message}\n`);
    void resolver.fail(job.data.doubtId);
  });
  worker.on('ready', () => process.stdout.write('Solvix doubt worker is ready.\n'));
  worker.on('error', (error) => process.stderr.write(`Doubt worker error: ${error.message}\n`));

  const shutdown = async (signal: string) => {
    process.stdout.write(`Received ${signal}; closing doubt worker.\n`);
    await Promise.allSettled([worker.close(), pool.end(), emitter.close()]);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void startWorker().catch((error: unknown) => {
  process.stderr.write(`Solvix doubt worker startup failed: ${String(error)}\n`);
  process.exitCode = 1;
});
