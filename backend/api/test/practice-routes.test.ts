import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { AppConfig } from '../src/config/env';
import type { AuthRepository } from '../src/domain/user';
import type { RedisService } from '../src/infra/redis';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 3000,
  databaseUrl: 'postgresql://solvix:local@localhost:5432/solvix',
  redisUrl: 'redis://localhost:6379',
  jwtSecret: 'unit-test-key-that-is-long-enough-for-hmac-sha256',
  jwtIssuer: 'solvix-practice-tests',
  jwtAccessTtl: '15m',
  bcryptRounds: 4,
  corsOrigins: [],
  mlServiceUrl: 'http://localhost:8000',
};

describe('submission endpoint', () => {
  it('requires authentication and records the confidence with the attempt', async () => {
    const userId = randomUUID();
    const questionId = randomUUID();
    let received: { confidence: number; timeTakenSec: number } | null = null;
    const app = createApp({
      repository: {} as AuthRepository,
      redis: { get: async () => null } as unknown as RedisService,
      config,
      submissionRepository: {
        submit: async (submittedUserId, input) => {
          expect(submittedUserId).toBe(userId);
          received = { confidence: input.confidence, timeTakenSec: input.timeTakenSec };
          return { isCorrect: true, solutionLatex: 'Worked solution.', attemptNo: 1 };
        },
      },
    });

    const body = { questionId, answer: 'A', timeTakenSec: 18, confidence: 4 };
    await request(app).post('/api/v1/submissions').send(body).expect(401);
    const token = jwt.sign(
      { role: 'student', arm: 'conf_elo' },
      config.jwtSecret,
      { algorithm: 'HS256', subject: userId, jwtid: randomUUID(), issuer: config.jwtIssuer, expiresIn: '15m' },
    );
    await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ questionId, answer: 'A', timeTakenSec: 18 })
      .expect(400);
    const response = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    expect(received).toEqual({ confidence: 4, timeTakenSec: 18 });
    expect(response.body.submission).toEqual({
      isCorrect: true,
      solutionLatex: 'Worked solution.',
      attemptNo: 1,
    });
  });
});
