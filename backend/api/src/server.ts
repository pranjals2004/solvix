import { resolve } from 'node:path';
import { createServer } from 'node:http';
import dotenv from 'dotenv';
import { createApp } from './app';
import { loadConfig } from './config/env';
import { PostgresAuthRepository } from './db/auth-repository';
import { createPool } from './db/pool';
import { IoredisService } from './infra/redis';
import { PostgresContentRepository } from './db/content-repository';
import { MlServiceEmbeddingClient } from './content/embedding-client';
import { ContentService } from './content/service';
import { PostgresSubmissionRepository } from './db/submission-repository';
import { PostgresDoubtRepository } from './db/doubt-repository';
import { BullDoubtQueue } from './doubts/queue';
import { S3PrivateObjectStorage } from './doubts/storage';
import { attachSocketServer } from './realtime/socket-server';
import type { Server as SocketServer } from 'socket.io';
import { PostgresLeaderboardRepository } from './db/leaderboard-repository';
import { RedisLeaderboardService } from './leaderboard/service';
import { PostgresPracticeRepository, PostgresProgressRepository } from './db/practice-repository';
import { PostgresMisconceptionRepository } from './db/misconception-repository';
import { BullMisconceptionQueue } from './misconceptions/queue';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function start() {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  const redis = new IoredisService(config.redisUrl);
  const queue = new BullDoubtQueue(config.redisUrl);
  const misconceptionQueue = new BullMisconceptionQueue(config.redisUrl);
  const leaderboardRepository = new PostgresLeaderboardRepository(pool);
  const leaderboard = new RedisLeaderboardService(
    leaderboardRepository,
    redis,
    config.leaderboardTimezone ?? 'Asia/Kolkata',
  );
  let server: ReturnType<typeof createServer> | undefined;
  let socketServer: SocketServer | undefined;

  try {
    if (config.nodeEnv !== 'test') await redis.connect();
    const contentRepository = new PostgresContentRepository(pool);
    const app = createApp({
      repository: new PostgresAuthRepository(pool),
      redis,
      config,
      contentService: new ContentService(
        contentRepository,
        new MlServiceEmbeddingClient(config.mlServiceUrl),
      ),
      submissionRepository: new PostgresSubmissionRepository(
        pool,
        config.leaderboardTimezone ?? 'Asia/Kolkata',
        config,
      ),
      practiceSelectionRepository: new PostgresPracticeRepository(
        pool,
        config.eloEpsilon,
        config.eloSigma,
      ),
      progressRepository: new PostgresProgressRepository(pool),
      doubtRepository: new PostgresDoubtRepository(pool),
      doubtQueue: queue,
      misconceptionRepository: new PostgresMisconceptionRepository(pool),
      misconceptionQueue,
      objectStorage: new S3PrivateObjectStorage(config),
      weeklyLeaderboard: leaderboard,
    });
    server = createServer(app);
    socketServer = attachSocketServer(server, config, redis);
    server.listen(config.port, () => {
      process.stdout.write(`Solvix API listening on port ${config.port}\n`);
    });
  } catch (error) {
    process.stderr.write(`Solvix API startup failed: ${String(error)}\n`);
    await Promise.allSettled([
      pool.end(),
      redis.close(),
      queue.close(),
      misconceptionQueue.close(),
    ]);
    process.exitCode = 1;
    return;
  }

  const shutdown = (signal: string) => {
    process.stdout.write(`Received ${signal}; closing services.\n`);
    const closeDependencies = () => {
      void Promise.allSettled([
        pool.end(),
        redis.close(),
        queue.close(),
        misconceptionQueue.close(),
      ]);
    };
    if (socketServer) socketServer.close(closeDependencies);
    else server?.close(closeDependencies);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void start().catch((error: unknown) => {
  process.stderr.write(`Solvix API startup failed: ${String(error)}\n`);
  process.exitCode = 1;
});
