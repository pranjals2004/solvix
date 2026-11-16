import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config/env';
import { asyncRoute } from '../http/async-route';
import { createRequireAuth } from '../http/auth';
import { requireRole } from '../http/access-control';
import { HttpError } from '../http/errors';
import type { RedisService } from '../infra/redis';
import type { WeeklyLeaderboard } from './types';
import { isMondayDate } from './week';

const weeklyQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });
const archiveQuery = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

export function createLeaderboardRouter(
  leaderboard: WeeklyLeaderboard,
  redis: RedisService,
  config: AppConfig,
): Router {
  const router = Router();
  router.use(createRequireAuth(redis, config));

  router.get('/leaderboard/weekly', asyncRoute(async (request, response) => {
    const parsed = weeklyQuery.safeParse(request.query);
    if (!parsed.success) throw new HttpError(400, 'INVALID_LIMIT', 'Limit must be between 1 and 100.');
    const userId = authenticatedUserId(request);
    response.json(await leaderboard.getWeekly(userId, parsed.data.limit));
  }));

  router.get('/leaderboard/archive', asyncRoute(async (request, response) => {
    const parsed = archiveQuery.safeParse(request.query);
    if (!parsed.success || !isMondayDate(parsed.data?.week ?? '')) {
      throw new HttpError(400, 'INVALID_WEEK', 'Provide a week start in YYYY-MM-DD format for a Monday.');
    }
    response.json(await leaderboard.getArchive(authenticatedUserId(request), parsed.data.week, parsed.data.limit));
  }));

  router.get('/admin/flagged-users', requireRole('admin'), asyncRoute(async (request, response) => {
    const parsed = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).safeParse(request.query);
    if (!parsed.success) throw new HttpError(400, 'INVALID_LIMIT', 'Limit must be between 1 and 100.');
    response.json({ accounts: await leaderboard.listFlaggedAccounts(parsed.data.limit) });
  }));

  return router;
}

function authenticatedUserId(request: Request): string {
  if (!request.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'A valid access token is required.');
  return request.auth.userId;
}
