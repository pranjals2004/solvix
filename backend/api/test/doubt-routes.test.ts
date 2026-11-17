import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { AppConfig } from '../src/config/env';
import type { AuthRepository } from '../src/domain/user';
import type { DoubtRecord, DoubtRepository, DoubtQueue, PrivateObjectStorage } from '../src/doubts/types';
import type { RedisService } from '../src/infra/redis';

const userId = randomUUID();
const config: AppConfig = {
  nodeEnv: 'test', port: 3000,
  databaseUrl: 'postgresql://solvix:local@localhost:5432/solvix',
  redisUrl: 'redis://localhost:6379',
  jwtSecret: 'unit-test-key-that-is-long-enough-for-hmac-sha256',
  jwtIssuer: 'solvix-doubt-tests', jwtAccessTtl: '15m', bcryptRounds: 4, corsOrigins: [],
  s3Endpoint: 'http://localhost:9000', s3PublicEndpoint: 'http://10.0.2.2:9000', s3Region: 'us-east-1', s3Bucket: 'test',
  s3AccessKey: 'test-key', s3SecretKey: 'test-secret',
};

class MemoryDoubts implements DoubtRepository {
  records = new Map<string, DoubtRecord>();
  keys = new Map<string, string>();

  async create(input: Parameters<DoubtRepository['create']>[0]) {
    const idempotency = `${input.userId}:${input.idempotencyKey}`;
    const existingId = this.keys.get(idempotency);
    const existing = existingId ? this.records.get(existingId) : undefined;
    if (existing) return { doubt: existing, created: false };
    const doubt: DoubtRecord = {
      id: randomUUID(), userId: input.userId, questionId: input.questionId, text: input.text,
      imageKey: input.imageKey, status: 'pending', conversation: [input.initialMessage],
      aiResponse: null, retrievalContext: null, error: null, createdAt: new Date(), completedAt: null,
    };
    this.records.set(doubt.id, doubt);
    this.keys.set(idempotency, doubt.id);
    return { doubt, created: true };
  }

  async getForUser(owner: string, id: string) {
    const doubt = this.records.get(id);
    return doubt?.userId === owner ? doubt : null;
  }
  async getById(id: string) { return this.records.get(id) ?? null; }
  async appendUserMessage(owner: string, id: string, message: DoubtRecord['conversation'][number]) {
    const doubt = await this.getForUser(owner, id);
    if (!doubt) return null;
    if (!doubt.conversation.some((item) => item.id === message.id)) doubt.conversation.push(message);
    doubt.status = 'pending';
    return doubt;
  }
  async setProcessing(id: string) { const doubt = this.records.get(id); if (doubt) doubt.status = 'processing'; }
  async getRetrievalContext() { return null; }
  async complete(id: string, answer: string, context: NonNullable<DoubtRecord['retrievalContext']>) {
    const doubt = this.records.get(id);
    if (!doubt) throw new Error('Doubt missing in test repository.');
    doubt.status = 'done'; doubt.aiResponse = answer; doubt.retrievalContext = context;
    doubt.conversation.push({ id: 'assistant-1', role: 'assistant', text: answer, createdAt: new Date().toISOString() });
    return doubt;
  }
  async fail(id: string, message: string) { const doubt = this.records.get(id); if (doubt) { doubt.status = 'failed'; doubt.error = message; } }
  async saveFeedback(owner: string, id: string) { return (await this.getForUser(owner, id)) !== null; }
}

class MemoryQueue implements DoubtQueue {
  jobs = new Map<string, { doubtId: string; attempts: number; delay: number }>();
  async add(_name: 'resolve', data: { doubtId: string }, options: { jobId: string; attempts: number; backoff: { type: 'exponential'; delay: number } }) {
    if (!this.jobs.has(options.jobId)) this.jobs.set(options.jobId, {
      doubtId: data.doubtId, attempts: options.attempts, delay: options.backoff.delay,
    });
  }
}

function buildApp() {
  const doubts = new MemoryDoubts();
  const queue = new MemoryQueue();
  const auth = {} as AuthRepository;
  const redis: RedisService = {
    async connect() {}, async get() { return null; }, async set() {},
    async sendCommand() { return 1; }, async ping() { return 'PONG'; }, async close() {},
  };
  const storage: PrivateObjectStorage = {
    async presignPut(owner, _contentType, _contentLength) {
      return { imageKey: `${owner}/image-1`, uploadUrl: 'http://minio/upload', expiresIn: 300 };
    },
    async getImage() { return { bytes: Buffer.from('image'), contentType: 'image/png', contentLength: 5 }; },
    async deleteUserObjects() {},
  };
  const app = createApp({ repository: auth, redis, config, doubtRepository: doubts, doubtQueue: queue, objectStorage: storage });
  return { app, doubts, queue, storage };
}

function bearer() {
  return `Bearer ${jwt.sign({ role: 'student', arm: 'random' }, config.jwtSecret, {
    algorithm: 'HS256', subject: userId, jwtid: randomUUID(), issuer: config.jwtIssuer, expiresIn: '15m',
  })}`;
}

describe('doubt API', () => {
  it('requires a valid session and signs a short-lived user-scoped image upload', async () => {
    const { app, storage } = buildApp();
    const unauthorized = await request(app).post('/api/v1/uploads/presign').send({ contentType: 'image/png', contentLength: 32 });
    expect(unauthorized.status).toBe(401);
    const signed = await request(app).post('/api/v1/uploads/presign')
      .set('Authorization', bearer()).send({ contentType: 'image/png', contentLength: 32 });
    expect(signed.status).toBe(200);
    expect(signed.body.imageKey).toMatch(new RegExp(`^${userId}/`));
    expect(signed.body.expiresIn).toBe(300);
    expect(storage).toBeDefined();
  });

  it('uses the doubt id as an idempotent queue job with exponential retries', async () => {
    const { app, queue } = buildApp();
    const body = { text: 'Why does this recurrence have logarithmic depth?' };
    const first = await request(app).post('/api/v1/doubts').set('Authorization', bearer()).set('Idempotency-Key', 'request-1').send(body);
    const repeated = await request(app).post('/api/v1/doubts').set('Authorization', bearer()).set('Idempotency-Key', 'request-1').send(body);
    expect(first.status).toBe(202);
    expect(repeated.body.doubtId).toBe(first.body.doubtId);
    expect(queue.jobs.size).toBe(1);
    expect(queue.jobs.get(first.body.doubtId)).toEqual({ doubtId: first.body.doubtId, attempts: 5, delay: 2000 });
  });

  it('rejects another user’s doubt and accepts owner feedback', async () => {
    const { app, doubts } = buildApp();
    const created = await request(app).post('/api/v1/doubts').set('Authorization', bearer()).send({ text: 'Explain this step.' });
    const doubtId = created.body.doubtId as string;
    const feedback = await request(app).post(`/api/v1/doubts/${doubtId}/feedback`).set('Authorization', bearer()).send({ helpful: true });
    expect(feedback.status).toBe(204);
    const other = jwt.sign({ role: 'student', arm: 'random' }, config.jwtSecret, {
      algorithm: 'HS256', subject: randomUUID(), jwtid: randomUUID(), issuer: config.jwtIssuer, expiresIn: '15m',
    });
    const privateRead = await request(app).get(`/api/v1/doubts/${doubtId}`).set('Authorization', `Bearer ${other}`);
    expect(privateRead.status).toBe(404);
    expect(doubts.records.get(doubtId)?.userId).toBe(userId);
  });

  it('queues one ordered follow-up and includes it in the saved conversation', async () => {
    const { app, doubts, queue } = buildApp();
    const created = await request(app).post('/api/v1/doubts')
      .set('Authorization', bearer()).set('Idempotency-Key', 'followup-base').send({ text: 'Explain this recurrence.' });
    const doubtId = created.body.doubtId as string;
    const doubt = doubts.records.get(doubtId);
    if (!doubt) throw new Error('Created doubt is missing in test repository.');
    doubt.status = 'done';
    const messageId = randomUUID();
    const body = { messageId, text: 'How does the final level contribute?' };
    const first = await request(app).post(`/api/v1/doubts/${doubtId}/messages`).set('Authorization', bearer()).send(body);
    const repeated = await request(app).post(`/api/v1/doubts/${doubtId}/messages`).set('Authorization', bearer()).send(body);
    expect(first.status).toBe(202);
    expect(repeated.body.jobId).toBe(first.body.jobId);
    expect(doubt.conversation.filter((message) => message.id === messageId)).toHaveLength(1);
    expect(queue.jobs.size).toBe(2);
  });
});
