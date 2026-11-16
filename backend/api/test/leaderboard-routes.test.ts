import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { AppConfig } from '../src/config/env';
import type { AuthRepository } from '../src/domain/user';
import type { WeeklyLeaderboard } from '../src/leaderboard/types';
import type { RedisService } from '../src/infra/redis';

const userId = randomUUID();
const config: AppConfig = {
  nodeEnv: 'test', port: 3000, databaseUrl: 'postgresql://solvix:local@localhost:5432/solvix',
  redisUrl: 'redis://localhost:6379', jwtSecret: 'unit-test-key-that-is-long-enough-for-hmac-sha256',
  jwtIssuer: 'solvix-leaderboard-tests', jwtAccessTtl: '15m', bcryptRounds: 4, corsOrigins: [],
  s3Endpoint: 'http://localhost:9000', s3PublicEndpoint: 'http://localhost:9000', s3Region: 'us-east-1',
  s3Bucket: 'test', s3AccessKey: 'test-key', s3SecretKey: 'test-secret',
};

function buildApp() {
  const token = jwt.sign({ role: 'student', arm: 'random' }, config.jwtSecret, {
    algorithm: 'HS256', subject: userId, jwtid: randomUUID(), issuer: config.jwtIssuer, expiresIn: '15m',
  });
  const leaderboard: WeeklyLeaderboard = {
    async getWeekly(caller, limit) {
      expect(caller).toBe(userId);
      expect(limit).toBe(10);
      return {
        weekStart: '2026-11-16',
        entries: [{ userId, name: 'A Student', solvedCount: 3, rank: 1 }],
        caller: { rank: 1, solvedCount: 3 },
      };
    },
    async getArchive(caller, week, limit) {
      expect(caller).toBe(userId);
      return {
        weekStart: week,
        entries: [{ userId, name: 'A Student', solvedCount: 8, rank: 2 }].slice(0, limit),
        caller: { rank: 2, solvedCount: 8 },
      };
    },
    async recordCount() {},
    async finalizeWeek() {},
    async listFlaggedAccounts(limit) {
      expect(limit).toBe(50);
      return [{ userId, name: 'A Student', email: 'student@example.edu', flaggedAt: new Date('2026-11-16T10:00:00Z') }];
    },
  };
  const app = createApp({
    repository: {} as AuthRepository,
    redis: { get: async () => null } as unknown as RedisService,
    config,
    weeklyLeaderboard: leaderboard,
  });
  return { app, token };
}

describe('leaderboard routes', () => {
  it('returns a bounded weekly top list and the caller rank', async () => {
    const { app, token } = buildApp();
    const response = await request(app).get('/api/v1/leaderboard/weekly?limit=10')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(response.body.caller).toEqual({ rank: 1, solvedCount: 3 });
    expect(response.body.entries[0]).toEqual({ userId, name: 'A Student', solvedCount: 3, rank: 1 });
  });

  it('requires authentication and accepts archive dates only for Mondays', async () => {
    const { app, token } = buildApp();
    await request(app).get('/api/v1/leaderboard/weekly').expect(401);
    await request(app).get('/api/v1/leaderboard/archive?week=2026-11-15')
      .set('Authorization', `Bearer ${token}`).expect(400);
    const response = await request(app).get('/api/v1/leaderboard/archive?week=2026-11-09&limit=10')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(response.body.weekStart).toBe('2026-11-09');
    expect(response.body.caller).toEqual({ rank: 2, solvedCount: 8 });
  });

  it('keeps the flagged account review endpoint admin-only', async () => {
    const { app } = buildApp();
    const studentToken = jwt.sign({ role: 'student', arm: 'random' }, config.jwtSecret, {
      algorithm: 'HS256', subject: userId, jwtid: randomUUID(), issuer: config.jwtIssuer, expiresIn: '15m',
    });
    await request(app).get('/api/v1/admin/flagged-users')
      .set('Authorization', `Bearer ${studentToken}`).expect(403);
  });
});
