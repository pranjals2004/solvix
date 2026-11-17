import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config/env';
import { asyncRoute } from '../http/async-route';
import { createRequireAuth } from '../http/auth';
import { HttpError } from '../http/errors';
import type { RedisService } from '../infra/redis';
import type { PeerDoubtRepository, PeerThread } from './types';

const threadInput = z.object({
  title: z.string().trim().min(5).max(120),
  body: z.string().trim().min(10).max(3000),
  subjectId: z.string().uuid().nullable().optional(),
  topicId: z.string().uuid().nullable().optional(),
  questionId: z.string().uuid().nullable().optional(),
  anonymous: z.boolean().default(false),
}).strict().refine((value) => !value.topicId || value.subjectId, {
  message: 'A subject is required when a topic is selected.',
});
const replyInput = z.object({ body: z.string().trim().min(2).max(2000) }).strict();
const listQuery = z.object({
  subjectId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const uuid = z.string().uuid();

export function createPeerDoubtRouter(
  repository: PeerDoubtRepository,
  redis: RedisService,
  config: AppConfig,
): Router {
  const router = Router();
  const requireAuth = createRequireAuth(redis, config);

  router.get('/community/threads', requireAuth, asyncRoute(async (request, response) => {
    const parsed = listQuery.safeParse(request.query);
    if (!parsed.success) throw new HttpError(400, 'INVALID_FILTER', 'The topic filter is invalid.');
    const { subjectId, topicId, limit } = parsed.data;
    response.json({ threads: await repository.list({ subjectId: subjectId ?? null, topicId: topicId ?? null, limit }) });
  }));

  router.post('/community/threads', requireAuth, asyncRoute(async (request, response) => {
    const parsed = threadInput.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_THREAD', 'Add a title and a question between 10 and 3,000 characters.');
    const userId = authenticatedUserId(request);
    await enforceLimit(redis, config, userId, 'threads', 5);
    let thread: PeerThread;
    try {
      thread = await repository.create(userId, {
        title: parsed.data.title,
        body: parsed.data.body,
        subjectId: parsed.data.subjectId ?? null,
        topicId: parsed.data.topicId ?? null,
        questionId: parsed.data.questionId ?? null,
        anonymous: parsed.data.anonymous,
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new HttpError(400, 'INVALID_REFERENCE', 'Choose an existing question, subject, and topic.');
      }
      throw error;
    }
    response.status(201).json({ thread });
  }));

  router.get('/community/threads/:threadId', requireAuth, asyncRoute(async (request, response) => {
    const threadId = parseId(request);
    const thread = await repository.get(threadId);
    if (!thread) throw new HttpError(404, 'NOT_FOUND', 'Thread not found.');
    response.json({ thread });
  }));

  router.post('/community/threads/:threadId/replies', requireAuth, asyncRoute(async (request, response) => {
    const parsed = replyInput.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_REPLY', 'Write a reply between 2 and 2,000 characters.');
    const userId = authenticatedUserId(request);
    await enforceLimit(redis, config, userId, 'replies', 20);
    const thread = await repository.reply(parseId(request), userId, parsed.data.body);
    if (!thread) throw new HttpError(404, 'NOT_FOUND', 'Thread not found.');
    response.status(201).json({ thread });
  }));

  return router;
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23503';
}

function parseId(request: Request): string {
  const parsed = uuid.safeParse(request.params.threadId);
  if (!parsed.success) throw new HttpError(400, 'INVALID_THREAD_ID', 'Provide a valid thread id.');
  return parsed.data;
}

function authenticatedUserId(request: Request): string {
  if (!request.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'A valid access token is required.');
  return request.auth.userId;
}

async function enforceLimit(
  redis: RedisService,
  config: AppConfig,
  userId: string,
  action: 'threads' | 'replies',
  maximum: number,
): Promise<void> {
  if (config.nodeEnv === 'test') return;
  const key = `rate:community:${action}:${userId}`;
  const count = Number(await redis.sendCommand(
    'EVAL',
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n",
    '1', key, '900',
  ));
  if (count > maximum) throw new HttpError(429, 'COMMUNITY_RATE_LIMIT', 'You have reached this posting limit. Try again in a few minutes.');
}
