import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { AppConfig } from '../src/config/env';
import type { AuthRepository } from '../src/domain/user';
import type { ContentService } from '../src/content/service';
import type { PeerDoubtRepository, PeerThread } from '../src/community/types';
import type { PrivacyRepository } from '../src/privacy/types';
import type { PrivateObjectStorage } from '../src/doubts/types';
import type { WeeklyLeaderboard } from '../src/leaderboard/types';
import type { RedisService } from '../src/infra/redis';

const userId = randomUUID();
const threadId = randomUUID();
const config: AppConfig = {
  nodeEnv: 'test', port: 3000, databaseUrl: 'postgresql://solvix:local@localhost:5432/solvix',
  redisUrl: 'redis://localhost:6379', jwtSecret: 'unit-test-key-that-is-long-enough-for-hmac-sha256',
  jwtIssuer: 'solvix-community-tests', jwtAccessTtl: '15m', bcryptRounds: 4, corsOrigins: [],
  s3Endpoint: 'http://localhost:9000', s3PublicEndpoint: 'http://localhost:9000', s3Region: 'us-east-1',
  s3Bucket: 'test', s3AccessKey: 'test-key', s3SecretKey: 'test-secret',
};

function makeThread(overrides: Partial<PeerThread> = {}): PeerThread {
  return {
    id: threadId, authorName: 'Anonymous student', isAnonymous: true, title: 'Confused about trees',
    body: 'How does the recurrence change when the tree is not balanced?', subjectId: null,
    subjectName: null, topicId: null, topicName: null, questionId: null,
    createdAt: new Date('2026-11-17T00:00:00Z'), replyCount: 0, replies: [], ...overrides,
  };
}

function buildApp() {
  const token = jwt.sign({ role: 'student', arm: 'random' }, config.jwtSecret, {
    algorithm: 'HS256', subject: userId, jwtid: randomUUID(), issuer: config.jwtIssuer, expiresIn: '15m',
  });
  const threads: PeerThread[] = [];
  const peerRepository: PeerDoubtRepository = {
    async list() { return threads; },
    async get(id) { return threads.find((thread) => thread.id === id) ?? null; },
    async create(_owner, input) {
      const thread = makeThread({
        authorName: input.anonymous ? 'Anonymous student' : 'A Student',
        isAnonymous: input.anonymous, title: input.title, body: input.body,
      });
      threads.push(thread);
      return thread;
    },
    async reply(id, _owner, body) {
      const thread = threads.find((value) => value.id === id);
      if (!thread) return null;
      const reply = { id: randomUUID(), authorName: 'A Student', body, createdAt: new Date() };
      const updated = { ...thread, replies: [...thread.replies, reply], replyCount: thread.replyCount + 1 };
      threads[threads.indexOf(thread)] = updated;
      return updated;
    },
  };
  let exists = true;
  const privacyRepository: PrivacyRepository = {
    async exportUserData() { return { user: { id: userId, name: 'A Student' }, submissions: [] }; },
    async userExists() { return exists; },
    async deleteUser() { exists = false; return true; },
  };
  const redis: RedisService = {
    values: new Map(),
    async connect() {},
    async get(key: string) { return (this.values as Map<string, string>).get(key) ?? null; },
    async set(key: string, value: string) { (this.values as Map<string, string>).set(key, value); },
    async sendCommand() { return 1; },
    async ping() { return 'PONG'; },
    async close() {},
  } as RedisService;
  let uploadsDeleted = false;
  let leaderboardRemoved = false;
  const storage: PrivateObjectStorage = {
    async presignPut() { return { imageKey: '', uploadUrl: '', expiresIn: 300 }; },
    async getImage() { return { bytes: Buffer.from(''), contentType: 'image/png', contentLength: 1 }; },
    async deleteUserObjects() { uploadsDeleted = true; },
  };
  const leaderboard: WeeklyLeaderboard = {
    async getWeekly() { return { weekStart: '2026-11-16', entries: [], caller: null }; },
    async getArchive() { return { weekStart: '2026-11-16', entries: [], caller: null }; },
    async recordCount() {}, async finalizeWeek() {}, async listFlaggedAccounts() { return []; },
    async removeUserFromCurrentWeek() { leaderboardRemoved = true; },
  };
  const app = createApp({
    repository: {} as AuthRepository,
    redis,
    config,
    contentService: { async listSubjects() { return []; } } as unknown as ContentService,
    peerDoubtRepository: peerRepository,
    privacyRepository,
    objectStorage: storage,
    weeklyLeaderboard: leaderboard,
  });
  return { app, token, threads, redis, uploadsDeleted: () => uploadsDeleted, leaderboardRemoved: () => leaderboardRemoved };
}

describe('peer doubt board routes', () => {
  it('keeps public content endpoints reachable when privacy and peer routes are mounted', async () => {
    const { app } = buildApp();
    await request(app).get('/api/v1/subjects').expect(200, { subjects: [] });
  });

  it('requires authentication, validates posts, and preserves anonymous authorship', async () => {
    const { app, token } = buildApp();
    await request(app).get('/api/v1/community/threads').expect(401);
    const invalid = await request(app).post('/api/v1/community/threads').set('Authorization', `Bearer ${token}`).send({ title: 'tiny', body: 'short' });
    expect(invalid.status).toBe(400);
    const created = await request(app).post('/api/v1/community/threads').set('Authorization', `Bearer ${token}`).send({
      title: 'Confused about trees', body: 'How does the recurrence change when the tree is not balanced?', anonymous: true,
    }).expect(201);
    expect(created.body.thread.authorName).toBe('Anonymous student');
    expect(created.body.thread.isAnonymous).toBe(true);
  });

  it('returns thread replies and rejects an unknown thread', async () => {
    const { app, token, threads } = buildApp();
    threads.push(makeThread());
    const auth = { Authorization: `Bearer ${token}` };
    const reply = await request(app).post(`/api/v1/community/threads/${threadId}/replies`).set(auth).send({ body: 'Try drawing the first two levels.' }).expect(201);
    expect(reply.body.thread.replyCount).toBe(1);
    expect(reply.body.thread.replies[0].body).toBe('Try drawing the first two levels.');
    await request(app).get(`/api/v1/community/threads/${randomUUID()}`).set(auth).expect(404);
  });
});

describe('privacy routes', () => {
  it('exports user data and removes account data, private uploads, and leaderboard projection', async () => {
    const { app, token, redis, uploadsDeleted, leaderboardRemoved } = buildApp();
    const auth = { Authorization: `Bearer ${token}` };
    const exported = await request(app).get('/api/v1/auth/me/export').set(auth).expect(200);
    expect(exported.headers['content-disposition']).toContain('solvix-account-data.json');
    expect(exported.body.data.user.name).toBe('A Student');
    await request(app).delete('/api/v1/auth/me').set(auth).send({ confirmation: 'no' }).expect(400);
    await request(app).delete('/api/v1/auth/me').set(auth).send({ confirmation: 'DELETE' }).expect(204);
    expect(uploadsDeleted()).toBe(true);
    expect(leaderboardRemoved()).toBe(true);
    expect((redis as unknown as { values: Map<string, string> }).values.has(`auth:deleted:${userId}`)).toBe(true);
    await request(app).get('/api/v1/community/threads').set(auth).expect(401);
  });
});
