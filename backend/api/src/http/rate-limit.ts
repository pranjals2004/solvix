import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { RedisStore } from 'rate-limit-redis';
import type { RedisService } from '../infra/redis';

export function createRateLimit(
  redis: RedisService,
  options: { limit: number; windowMs: number; keyPrefix: string; enabled: boolean },
): RequestHandler {
  const store = options.enabled
    ? new RedisStore({
        prefix: `${options.keyPrefix}:`,
        sendCommand: (...args) => redis.sendCommand(...args),
      })
    : undefined;

  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store,
    handler: (_request, response) => {
      response.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' },
      });
    },
  });
}
