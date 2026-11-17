import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config/env';
import { createRequireAuth } from '../http/auth';
import { asyncRoute } from '../http/async-route';
import { HttpError } from '../http/errors';
import type { RedisService } from '../infra/redis';
import { createDoubtSchema, feedbackSchema, followupSchema, presignSchema } from './schemas';
import type { DoubtQueue, DoubtRecord, DoubtRepository, PrivateObjectStorage } from './types';
import { publicUploadEndpointForOrigin } from './public-upload-origin';

const DOUBT_WINDOW_SECONDS = 600;

export function createDoubtRouter(dependencies: {
  repository: DoubtRepository;
  queue: DoubtQueue;
  storage: PrivateObjectStorage;
  redis: RedisService;
  config: AppConfig;
}): Router {
  const router = Router();
  router.use(createRequireAuth(dependencies.redis, dependencies.config));

  router.post('/uploads/presign', asyncRoute(async (request, response) => {
    const parsed = presignSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_UPLOAD', 'Choose a JPEG, PNG, or WebP image up to 5 MB.');
    const principal = authenticatedUser(request);
    await enforceUserLimit(dependencies.redis, principal.userId, dependencies.config.nodeEnv, 'uploads', 20);
    const publicEndpoint = publicUploadEndpointForOrigin(
      dependencies.config.s3PublicEndpoint,
      request.header('origin'),
      dependencies.config.nodeEnv,
    );
    const upload = await dependencies.storage.presignPut(
      principal.userId,
      parsed.data.contentType,
      parsed.data.contentLength,
      publicEndpoint,
    );
    response.json(upload);
  }));

  router.post('/doubts', asyncRoute(async (request, response) => {
    const parsed = createDoubtSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_DOUBT', 'Provide a question or an image, with optional text.');
    const { userId } = authenticatedUser(request);
    await enforceUserLimit(dependencies.redis, userId, dependencies.config.nodeEnv, 'create', 10);
    if (parsed.data.imageKey && !parsed.data.imageKey.startsWith(`${userId}/`)) {
      throw new HttpError(400, 'INVALID_IMAGE', 'The uploaded image does not belong to this account.');
    }
    const idempotencyKey = request.header('idempotency-key')?.trim() || randomUUID();
    if (idempotencyKey.length > 128) throw new HttpError(400, 'INVALID_REQUEST', 'The request key is too long.');
    const initialText = parsed.data.text ?? 'Please inspect my handwritten work and help me understand my reasoning.';
    const created = await dependencies.repository.create({
      userId,
      questionId: parsed.data.questionId ?? null,
      text: parsed.data.text ?? null,
      imageKey: parsed.data.imageKey ?? null,
      idempotencyKey,
      initialMessage: { id: randomUUID(), role: 'user', text: initialText, createdAt: new Date().toISOString() },
    });
    if (created.doubt.status === 'pending' && !created.doubt.aiResponse) {
      await dependencies.queue.add('resolve', { doubtId: created.doubt.id }, {
        jobId: created.doubt.id, attempts: 5, backoff: { type: 'exponential', delay: 2000 },
      });
    }
    response.status(202).json({ doubtId: created.doubt.id, jobId: created.doubt.id, status: created.doubt.status });
  }));

  router.get('/doubts/:id', asyncRoute(async (request, response) => {
    const doubt = await dependencies.repository.getForUser(authenticatedUser(request).userId, routeDoubtId(request));
    if (!doubt) throw new HttpError(404, 'NOT_FOUND', 'Doubt not found.');
    response.json(publicDoubt(doubt));
  }));

  router.post('/doubts/:id/messages', asyncRoute(async (request, response) => {
    const parsed = followupSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_MESSAGE', 'A follow-up message is required.');
    const { userId } = authenticatedUser(request);
    await enforceUserLimit(dependencies.redis, userId, dependencies.config.nodeEnv, 'followup', 20);
    const doubtId = routeDoubtId(request);
    const doubt = await dependencies.repository.getForUser(userId, doubtId);
    if (!doubt) throw new HttpError(404, 'NOT_FOUND', 'Doubt not found.');
    const messageId = parsed.data.messageId ?? randomUUID();
    const alreadyQueued = doubt.conversation.some((message) => message.id === messageId);
    if (!alreadyQueued && doubt.status !== 'done') {
      throw new HttpError(409, 'DOUBT_NOT_READY', 'Wait for the current explanation before sending a follow-up.');
    }
    const updated = await dependencies.repository.appendUserMessage(userId, doubtId, {
      id: messageId, role: 'user', text: parsed.data.text, createdAt: new Date().toISOString(),
    });
    if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Doubt not found.');
    await dependencies.queue.add('resolve', { doubtId: doubt.id }, {
      jobId: `${doubt.id}-${messageId}`, attempts: 5, backoff: { type: 'exponential', delay: 2000 },
    });
    response.status(202).json({ doubtId: doubt.id, jobId: `${doubt.id}-${messageId}`, status: updated.status });
  }));

  router.post('/doubts/:id/feedback', asyncRoute(async (request, response) => {
    const parsed = feedbackSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_FEEDBACK', 'Choose whether the explanation was helpful.');
    const { userId } = authenticatedUser(request);
    const saved = await dependencies.repository.saveFeedback(userId, routeDoubtId(request), parsed.data.helpful);
    if (!saved) throw new HttpError(404, 'NOT_FOUND', 'Doubt not found.');
    response.status(204).end();
  }));

  return router;
}

function authenticatedUser(request: Request) {
  if (!request.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'A valid access token is required.');
  return request.auth;
}

function routeDoubtId(request: Request): string {
  const parsed = z.string().uuid().safeParse(request.params.id);
  if (!parsed.success) throw new HttpError(400, 'INVALID_DOUBT_ID', 'Provide a valid doubt id.');
  return parsed.data;
}

async function enforceUserLimit(
  redis: RedisService,
  userId: string,
  nodeEnv: AppConfig['nodeEnv'],
  action: 'create' | 'followup' | 'uploads',
  maximum: number,
): Promise<void> {
  if (nodeEnv === 'test') return;
  const key = `rate:doubts:${action}:${userId}`;
  const count = Number(await redis.sendCommand(
    'EVAL',
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n",
    '1', key, String(DOUBT_WINDOW_SECONDS),
  ));
  if (count > maximum) throw new HttpError(429, 'DOUBT_RATE_LIMIT', 'You have reached this request limit. Try again in a few minutes.');
}

function publicDoubt(doubt: DoubtRecord) {
  return {
    id: doubt.id,
    status: doubt.status,
    text: doubt.text,
    imageKey: doubt.imageKey,
    conversation: doubt.conversation,
    aiResponse: doubt.aiResponse,
    retrievalContext: doubt.retrievalContext,
    error: doubt.error,
    createdAt: doubt.createdAt,
    completedAt: doubt.completedAt,
    aiGenerated: true,
  };
}
