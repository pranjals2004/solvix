import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import type { AppConfig } from './config/env';
import type { AuthRepository } from './domain/user';
import { createContentRouter } from './content/routes';
import type { ContentService } from './content/service';
import { createAuthRouter } from './http/auth';
import { HttpError } from './http/errors';
import { createRateLimit } from './http/rate-limit';
import type { RedisService } from './infra/redis';

export type AppDependencies = {
  repository: AuthRepository;
  redis: RedisService;
  config: AppConfig;
  contentService?: ContentService;
};

export function createApp(dependencies: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || dependencies.config.corsOrigins.includes(origin));
    },
  }));
  app.use(pinoHttp({
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
  }));
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

  app.use('/api/v1', createRateLimit(dependencies.redis, {
    limit: 120,
    windowMs: 60_000,
    keyPrefix: 'rate:api',
    enabled: dependencies.config.nodeEnv !== 'test',
  }));
  app.use('/api/v1/auth', createAuthRouter(dependencies));
  if (dependencies.contentService) {
    app.use('/api/v1', createContentRouter(dependencies.contentService, dependencies.redis, dependencies.config));
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
  return typeof error === 'object' && error !== null && 'status' in error &&
    typeof error.status === 'number';
}
