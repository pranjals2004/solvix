import { Router } from 'express';
import type { AppConfig } from '../config/env';
import type { RedisService } from '../infra/redis';
import { asyncRoute } from '../http/async-route';
import { createRequireAuth } from '../http/auth';
import { HttpError } from '../http/errors';
import type { SubmissionRepository } from './types';
import { submissionInputSchema } from './schemas';
import type { WeeklyLeaderboard } from '../leaderboard/types';

export function createPracticeRouter(
  repository: SubmissionRepository,
  redis: RedisService,
  config: AppConfig,
  leaderboard?: WeeklyLeaderboard,
): Router {
  const router = Router();
  router.use(createRequireAuth(redis, config));

  router.post('/submissions', asyncRoute(async (request, response) => {
    const parsed = submissionInputSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Provide an answer, confidence from 1 to 5, and a valid time.');
    }
    if (!request.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'A valid access token is required.');
    const result = await repository.submit(request.auth.userId, parsed.data);
    if (!result) throw new HttpError(404, 'NOT_FOUND', 'Question not found.');
    if (result.countedForRank && result.leaderboardWeekStart && leaderboard) {
      try {
        await leaderboard.recordCount(request.auth.userId, result.leaderboardWeekStart);
      } catch {
        // PostgreSQL keeps the durable weekly count; the next leaderboard read repairs Redis.
        process.stderr.write('Leaderboard projection update deferred; weekly read will reconcile it.\n');
      }
    }
    response.status(201).json({
      submission: {
        isCorrect: result.isCorrect,
        solutionLatex: result.solutionLatex,
        attemptNo: result.attemptNo,
        countedForRank: result.countedForRank,
        leaderboardWeekStart: result.leaderboardWeekStart,
        rankExclusionReason: result.rankExclusionReason,
      },
    });
  }));
  return router;
}
