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
  s3Endpoint: 'http://localhost:9000',
  s3PublicEndpoint: 'http://10.0.2.2:9000',
  s3Region: 'us-east-1',
  s3Bucket: 'test',
  s3AccessKey: 'test-key',
  s3SecretKey: 'test-secret',
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
        submit: async (submittedUserId, _arm, input) => {
          expect(submittedUserId).toBe(userId);
          received = { confidence: input.confidence, timeTakenSec: input.timeTakenSec };
          return {
            isCorrect: true,
            solutionLatex: 'Worked solution.',
            attemptNo: 1,
            countedForRank: true,
            leaderboardWeekStart: '2026-11-16',
            rankExclusionReason: null,
            skillRatingBefore: 1000,
            skillRatingAfter: 1010,
            questionRatingBefore: 1000,
            questionRatingAfter: 990,
            expected: 0.5,
            kEffective: 32,
          };
        },
      },
    });

    const body = { questionId, answer: 'A', timeTakenSec: 18, confidence: 4 };
    await request(app).post('/api/v1/submissions').send(body).expect(401);
    const token = jwt.sign({ role: 'student', arm: 'conf_elo' }, config.jwtSecret, {
      algorithm: 'HS256',
      subject: userId,
      jwtid: randomUUID(),
      issuer: config.jwtIssuer,
      expiresIn: '15m',
    });
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
      countedForRank: true,
      leaderboardWeekStart: '2026-11-16',
      rankExclusionReason: null,
      skillRatingBefore: 1000,
      skillRatingAfter: 1010,
      questionRatingBefore: 1000,
      questionRatingAfter: 990,
      expected: 0.5,
      kEffective: 32,
    });
  });

  it('returns the reason when a correct attempt is too fast to count', async () => {
    const userId = randomUUID();
    const questionId = randomUUID();
    const app = createApp({
      repository: {} as AuthRepository,
      redis: { get: async () => null } as unknown as RedisService,
      config,
      submissionRepository: {
        submit: async () => ({
          isCorrect: true,
          solutionLatex: 'Solution.',
          attemptNo: 2,
          countedForRank: false,
          leaderboardWeekStart: null,
          rankExclusionReason: 'too_fast',
          skillRatingBefore: 1000,
          skillRatingAfter: 984,
          questionRatingBefore: 1000,
          questionRatingAfter: 1016,
          expected: 0.5,
          kEffective: 32,
        }),
      },
    });
    const token = jwt.sign({ role: 'student', arm: 'conf_elo' }, config.jwtSecret, {
      algorithm: 'HS256',
      subject: userId,
      jwtid: randomUUID(),
      issuer: config.jwtIssuer,
      expiresIn: '15m',
    });
    const response = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ questionId, answer: 'A', timeTakenSec: 3, confidence: 4 })
      .expect(201);
    expect(response.body.submission.countedForRank).toBe(false);
    expect(response.body.submission.rankExclusionReason).toBe('too_fast');
  });

  it('authenticates adaptive selection and progress endpoints', async () => {
    const userId = randomUUID();
    const topicId = randomUUID();
    const questionId = randomUUID();
    const app = createApp({
      repository: {} as AuthRepository,
      redis: { get: async () => null } as unknown as RedisService,
      config,
      submissionRepository: { submit: async () => null },
      practiceSelectionRepository: {
        next: async (selectedUserId, arm, selectedTopicId) => {
          expect(selectedUserId).toBe(userId);
          expect(arm).toBe('standard_elo');
          expect(selectedTopicId).toBe(topicId);
          return {
            question: {
              id: questionId,
              subjectId: randomUUID(),
              topicId,
              type: 'mcq',
              statementLatex: 'Sample statement',
              optionsJson: ['A', 'B'],
              isPyq: false,
              pyqYear: null,
              difficultyRating: 1000,
            },
            isResurfaced: false,
            selectionMode: 'adaptive',
            skillRating: 1000,
          };
        },
      },
      progressRepository: {
        getProgress: async () => ({ topics: [], observations: [] }),
      },
    });
    const token = jwt.sign({ role: 'student', arm: 'standard_elo' }, config.jwtSecret, {
      algorithm: 'HS256',
      subject: userId,
      jwtid: randomUUID(),
      issuer: config.jwtIssuer,
      expiresIn: '15m',
    });
    await request(app).get(`/api/v1/practice/next?topicId=${topicId}`).expect(401);
    const next = await request(app)
      .get(`/api/v1/practice/next?topicId=${topicId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(next.body.question.id).toBe(questionId);
    expect(next.body.question).not.toHaveProperty('correctAnswerJson');
    const progress = await request(app)
      .get('/api/v1/progress')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(progress.body).toEqual({ topics: [], observations: [] });
  });
});
