import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { AppConfig } from '../src/config/env';
import type { AuthRepository, UserRecord } from '../src/domain/user';
import type { ContentRepository } from '../src/content/types';
import { ContentService } from '../src/content/service';
import type { RedisService } from '../src/infra/redis';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 3000,
  databaseUrl: 'postgresql://solvix:local@localhost:5432/solvix',
  redisUrl: 'redis://localhost:6379',
  jwtSecret: 'unit-test-key-that-is-long-enough-for-hmac-sha256',
  jwtIssuer: 'solvix-content-tests',
  jwtAccessTtl: '15m',
  bcryptRounds: 4,
  corsOrigins: [],
  mlServiceUrl: 'http://localhost:8000',
  s3Endpoint: 'http://localhost:9000', s3PublicEndpoint: 'http://10.0.2.2:9000', s3Region: 'us-east-1', s3Bucket: 'test',
  s3AccessKey: 'test-key', s3SecretKey: 'test-secret',
};

class TestUsers implements AuthRepository {
  private readonly users = new Map<string, UserRecord & { passwordHash: string }>();

  async createStudent(input: { name: string; email: string; passwordHash: string }) {
    const user = {
      id: randomUUID(),
      ...input,
      role: 'student' as const,
      arm: 'random' as const,
      createdAt: new Date(),
      isFlagged: false,
    };
    this.users.set(user.id, user);
    return user;
  }

  async findByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findById(id: string) {
    const { passwordHash: _passwordHash, ...user } = this.users.get(id) ?? {} as UserRecord & { passwordHash: string };
    return user.id ? user : null;
  }

  async ping() {}
}

class TestRedis implements RedisService {
  async connect() {}
  async get() { return null; }
  async set() {}
  async sendCommand() { return 'OK'; }
  async ping() { return 'PONG'; }
  async close() {}
}

describe('content routes', () => {
  it('keeps public question responses answer-free and protects admin writes', async () => {
    const publicQuestion = {
      id: randomUUID(),
      subjectId: randomUUID(),
      topicId: randomUUID(),
      type: 'mcq' as const,
      statementLatex: 'Select the correct option.',
      optionsJson: ['A', 'B'],
      isPyq: false,
      pyqYear: null,
      difficultyRating: 1000,
    };
    const adminQuestion = {
      ...publicQuestion,
      correctAnswerJson: 'A',
      natTolerance: null,
      solutionLatex: 'A is correct because it matches the definition.',
      attemptCount: 0,
      createdAt: new Date(),
    };
    const contentRepository = {
      getPublicQuestion: async () => publicQuestion,
      listQuestions: async () => [publicQuestion],
      getAdminQuestion: async () => adminQuestion,
      listAdminQuestions: async () => [adminQuestion],
      listSubjects: async () => [],
      listTopics: async () => [],
      listNotes: async () => [],
    } as unknown as ContentRepository;
    const content = new ContentService(contentRepository, { embed: async () => [] });
    const app = createApp({
      repository: new TestUsers(),
      redis: new TestRedis(),
      config,
      contentService: content,
    });

    const publicResponse = await request(app).get(`/api/v1/questions/${publicQuestion.id}`).expect(200);
    expect(publicResponse.body.question).toEqual(publicQuestion);
    expect(publicResponse.body.question).not.toHaveProperty('correctAnswerJson');
    expect(publicResponse.body.question).not.toHaveProperty('solutionLatex');

    const adminToken = jwt.sign(
      { role: 'admin', arm: 'random' },
      config.jwtSecret,
      {
        algorithm: 'HS256',
        subject: randomUUID(),
        jwtid: randomUUID(),
        issuer: config.jwtIssuer,
        expiresIn: '15m',
      },
    );
    const adminResponse = await request(app)
      .get(`/api/v1/admin/questions/${publicQuestion.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminResponse.body.question.correctAnswerJson).toBe('A');
    expect(adminResponse.body.question.solutionLatex).toContain('definition');

    await request(app).post('/api/v1/admin/subjects').send({ name: 'DBMS', slug: 'dbms' }).expect(401);
    const registration = await request(app).post('/api/v1/auth/register').send({
      name: 'Student',
      email: 'student@example.test',
      password: 'a-long-test-password',
      consent: true,
    }).expect(201);
    await request(app)
      .post('/api/v1/admin/subjects')
      .set('Authorization', `Bearer ${registration.body.token}`)
      .send({ name: 'DBMS', slug: 'dbms' })
      .expect(403);
  });
});
