import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config/env';
import { asyncRoute } from '../http/async-route';
import { createRequireAuth } from '../http/auth';
import { HttpError } from '../http/errors';
import type { PrivateObjectStorage } from '../doubts/types';
import type { WeeklyLeaderboard } from '../leaderboard/types';
import type { RedisService } from '../infra/redis';
import type { PrivacyRepository } from './types';

const deleteSchema = z.object({ confirmation: z.literal('DELETE') }).strict();

export function createPrivacyRouter(dependencies: {
  repository: PrivacyRepository;
  redis: RedisService;
  config: AppConfig;
  storage: PrivateObjectStorage;
  weeklyLeaderboard: WeeklyLeaderboard;
}): Router {
  const router = Router();
  const requireAuth = createRequireAuth(dependencies.redis, dependencies.config);

  router.get('/auth/me/export', requireAuth, asyncRoute(async (request, response) => {
    const userId = authenticatedUserId(request);
    const data = await dependencies.repository.exportUserData(userId);
    if (!data) throw new HttpError(404, 'NOT_FOUND', 'Account not found.');
    response.setHeader('Content-Disposition', 'attachment; filename="solvix-account-data.json"');
    response.json({ exportedAt: new Date().toISOString(), data });
  }));

  router.delete('/auth/me', requireAuth, asyncRoute(async (request, response) => {
    const parsed = deleteSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'CONFIRMATION_REQUIRED', 'Send confirmation: DELETE to remove this account.');
    const principal = request.auth;
    if (!principal) throw new HttpError(401, 'UNAUTHENTICATED', 'A valid access token is required.');
    if (!(await dependencies.repository.userExists(principal.userId))) {
      throw new HttpError(404, 'NOT_FOUND', 'Account not found.');
    }

    // Remove private uploads and revoke every token before deleting the account row.
    const deletedKey = `auth:deleted:${principal.userId}`;
    const blocklistKey = `auth:blocklist:${principal.tokenId}`;
    await dependencies.storage.deleteUserObjects(principal.userId);
    await dependencies.redis.set(deletedKey, '1', 315_360_000);
    try {
      const remaining = principal.expiresAt - Math.floor(Date.now() / 1000);
      if (remaining > 0) await dependencies.redis.set(blocklistKey, '1', remaining);
      await dependencies.weeklyLeaderboard.removeUserFromCurrentWeek(principal.userId);
      const deleted = await dependencies.repository.deleteUser(principal.userId);
      if (!deleted) throw new HttpError(404, 'NOT_FOUND', 'Account not found.');
    } catch (error) {
      // If the account row still exists, restore authentication so deletion can be retried.
      if (await dependencies.repository.userExists(principal.userId).catch(() => false)) {
        await dependencies.redis.sendCommand('DEL', deletedKey, blocklistKey).catch(() => undefined);
      }
      throw error;
    }
    response.status(204).end();
  }));

  return router;
}

function authenticatedUserId(request: Request): string {
  if (!request.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'A valid access token is required.');
  return request.auth.userId;
}
