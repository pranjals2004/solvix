import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config/env';
import { requireRole } from '../http/access-control';
import { asyncRoute } from '../http/async-route';
import { createRequireAuth } from '../http/auth';
import { HttpError } from '../http/errors';
import type { RedisService } from '../infra/redis';
import type { MisconceptionQueue, MisconceptionRepository } from './types';

const uuidSchema = z.string().uuid();
const labelSchema = z
  .object({
    label: z.string().trim().min(3).max(200),
  })
  .strict();
const clusterFilterSchema = z.object({ topicId: uuidSchema.optional() }).strict();

export function createMisconceptionRouter(dependencies: {
  repository: MisconceptionRepository;
  queue: MisconceptionQueue;
  redis: RedisService;
  config: AppConfig;
}): Router {
  const router = Router();

  router.get(
    '/misconceptions/hints',
    createRequireAuth(dependencies.redis, dependencies.config),
    asyncRoute(async (request, response) => {
      if (!request.auth)
        throw new HttpError(401, 'UNAUTHENTICATED', 'A valid access token is required.');
      response.json({ hints: await dependencies.repository.listStudentHints(request.auth.userId) });
    }),
  );

  const admin = Router();
  admin.use(createRequireAuth(dependencies.redis, dependencies.config), requireRole('admin'));

  admin.post(
    '/run',
    asyncRoute(async (_request, response) => {
      const runId = randomUUID();
      await dependencies.repository.createQueuedRun(runId);
      try {
        await dependencies.queue.enqueue(runId);
      } catch (error) {
        await dependencies.repository.failQueuedRun(runId, 'Queue submission failed.');
        throw error;
      }
      response.status(202).json({ runId, jobId: runId, status: 'queued' });
    }),
  );

  admin.get(
    '/clusters',
    asyncRoute(async (request, response) => {
      const parsed = clusterFilterSchema.safeParse(request.query);
      if (!parsed.success) throw new HttpError(400, 'INVALID_REQUEST', 'Provide a valid topic id.');
      response.json({
        clusters: await dependencies.repository.listAdminClusters(parsed.data.topicId),
      });
    }),
  );

  admin.get(
    '/runs/:runId',
    asyncRoute(async (request, response) => {
      const runId = uuidSchema.safeParse(request.params.runId);
      if (!runId.success) throw new HttpError(400, 'INVALID_REQUEST', 'Provide a valid run id.');
      const topics = await dependencies.repository.getRunStatus(runId.data);
      if (topics.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Clustering run not found.');
      response.json({ runId: runId.data, topics });
    }),
  );

  admin.patch(
    '/clusters/:clusterId',
    asyncRoute(async (request, response) => {
      const clusterId = uuidSchema.safeParse(request.params.clusterId);
      const body = labelSchema.safeParse(request.body);
      if (!clusterId.success || !body.success) {
        throw new HttpError(
          400,
          'INVALID_REQUEST',
          'Provide a valid cluster id and a 3 to 200 character label.',
        );
      }
      const cluster = await dependencies.repository.labelCluster(clusterId.data, body.data.label);
      if (!cluster)
        throw new HttpError(404, 'NOT_FOUND', 'Current misconception cluster not found.');
      response.json({ cluster });
    }),
  );

  router.use('/admin/misconceptions', admin);
  return router;
}
