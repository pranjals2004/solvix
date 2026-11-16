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
        sendCommand: async (...args) => {
          const result = await redis.sendCommand(...args);
          if (result === null) return 0;
          if (Array.isArray(result)) return result.map(String);
          return typeof result === 'boolean' ? Number(result) : result;
        },
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
