import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import type { AppConfig } from './config/env';
import type { AuthRepository } from './domain/user';
import { createContentRouter } from './content/routes';
import type { ContentService } from './content/service';
import { createPracticeRouter } from './practice/routes';
import type { SubmissionRepository } from './practice/types';
import type { PracticeSelectionRepository, ProgressRepository } from './practice/types';
import { createAuthRouter } from './http/auth';
import { HttpError } from './http/errors';
import { createRateLimit } from './http/rate-limit';
import type { RedisService } from './infra/redis';
import { createDoubtRouter } from './doubts/routes';
import type { DoubtQueue, DoubtRepository, PrivateObjectStorage } from './doubts/types';
import { createLeaderboardRouter } from './leaderboard/routes';
import type { WeeklyLeaderboard } from './leaderboard/types';
import { createMisconceptionRouter } from './misconceptions/routes';
import type { MisconceptionQueue, MisconceptionRepository } from './misconceptions/types';

export type AppDependencies = {
  repository: AuthRepository;
  redis: RedisService;
  config: AppConfig;
  contentService?: ContentService;
  submissionRepository?: SubmissionRepository;
  practiceSelectionRepository?: PracticeSelectionRepository;
  progressRepository?: ProgressRepository;
  doubtRepository?: DoubtRepository;
  doubtQueue?: DoubtQueue;
  objectStorage?: PrivateObjectStorage;
  weeklyLeaderboard?: WeeklyLeaderboard;
  misconceptionRepository?: MisconceptionRepository;
  misconceptionQueue?: MisconceptionQueue;
};

export function createApp(dependencies: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || dependencies.config.corsOrigins.includes(origin));
      },
    }),
  );
  app.use(
    pinoHttp({
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      serializers: {
        req(request) {
          return {
            id: request.id,
            method: request.method,
            url: request.url?.split('?')[0],
            remoteAddress: request.remoteAddress,
          };
        },
      },
      autoLogging: dependencies.config.nodeEnv !== 'test' && {
        ignore: (request) => request.url === '/health',
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  const health = (_request: express.Request, response: express.Response) => {
    response.json({ status: 'ok' });
  };
  app.get('/health', health);
  app.get('/api/v1/health', health);
  app.get('/ready', async (_request, response) => {
    const checks = await Promise.allSettled([
      dependencies.repository.ping(),
      dependencies.redis.ping(),
    ]);
    const ready = checks.every((check) => check.status === 'fulfilled');
    response.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      dependencies: {
        postgres: checks[0]?.status === 'fulfilled' ? 'ok' : 'unavailable',
        redis: checks[1]?.status === 'fulfilled' ? 'ok' : 'unavailable',
      },
    });
  });

  app.use(
    '/api/v1',
    createRateLimit(dependencies.redis, {
      limit: 120,
      windowMs: 60_000,
      keyPrefix: 'rate:api',
      enabled: dependencies.config.nodeEnv !== 'test',
    }),
  );
  app.use('/api/v1/auth', createAuthRouter(dependencies));
  if (dependencies.contentService) {
    app.use(
      '/api/v1',
      createContentRouter(dependencies.contentService, dependencies.redis, dependencies.config),
    );
  }
  if (dependencies.submissionRepository) {
    app.use(
      '/api/v1',
      createPracticeRouter(
        dependencies.submissionRepository,
        dependencies.redis,
        dependencies.config,
        dependencies.weeklyLeaderboard,
        dependencies.practiceSelectionRepository,
        dependencies.progressRepository,
      ),
    );
  }
  if (dependencies.weeklyLeaderboard) {
    app.use(
      '/api/v1',
      createLeaderboardRouter(
        dependencies.weeklyLeaderboard,
        dependencies.redis,
        dependencies.config,
      ),
    );
  }
  if (dependencies.doubtRepository && dependencies.doubtQueue && dependencies.objectStorage) {
    app.use(
      '/api/v1',
      createDoubtRouter({
        repository: dependencies.doubtRepository,
        queue: dependencies.doubtQueue,
        storage: dependencies.objectStorage,
        redis: dependencies.redis,
        config: dependencies.config,
      }),
    );
  }
  if (dependencies.misconceptionRepository && dependencies.misconceptionQueue) {
    app.use(
      '/api/v1',
      createMisconceptionRouter({
        repository: dependencies.misconceptionRepository,
        queue: dependencies.misconceptionQueue,
        redis: dependencies.redis,
        config: dependencies.config,
      }),
    );
  }
  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (response.headersSent) return;
    if (error instanceof HttpError) {
      response.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }
    if (isRequestError(error) && error.status >= 400 && error.status < 500) {
      response.status(error.status).json({
        error: { code: 'INVALID_REQUEST', message: 'The request could not be processed.' },
      });
      return;
    }
    response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    });
  };
  app.use(errorHandler);
  return app;
}

function isRequestError(error: unknown): error is { status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  );
}
