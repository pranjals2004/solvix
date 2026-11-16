import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { AppConfig } from '../src/config/env';
import type { AuthRepository, ExperimentArm, UserRecord } from '../src/domain/user';
import type { RedisService } from '../src/infra/redis';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 3000,
  databaseUrl: 'postgresql://solvix:local@localhost:5432/solvix',
  redisUrl: 'redis://localhost:6379',
  jwtSecret: 'unit-test-key-that-is-long-enough-for-hmac-sha256',
  jwtIssuer: 'solvix-tests',
  jwtAccessTtl: '15m',
  bcryptRounds: 4,
  corsOrigins: ['http://localhost:3000'],
  s3Endpoint: 'http://localhost:9000', s3PublicEndpoint: 'http://10.0.2.2:9000', s3Region: 'us-east-1', s3Bucket: 'test',
  s3AccessKey: 'test-key', s3SecretKey: 'test-secret',
};

class MemoryRepository implements AuthRepository {
  readonly users = new Map<string, UserRecord & { passwordHash: string }>();
  ready = true;
  nextArm: ExperimentArm = 'random';

  async createStudent(input: { name: string; email: string; passwordHash: string }) {
    if (await this.findByEmail(input.email)) {
      throw Object.assign(new Error('duplicate'), { code: '23505' });
    }
    const user = {
      id: randomUUID(),
      name: input.name,
      email: input.email,
      role: 'student' as const,
      arm: this.nextArm,
      createdAt: new Date(),
      isFlagged: false,
      passwordHash: input.passwordHash,
    };
    this.users.set(user.id, user);
    return user;
  }

  async findByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async findById(id: string) {
    const user = this.users.get(id);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      arm: user.arm,
      createdAt: user.createdAt,
      isFlagged: user.isFlagged,
    };
  }

  async ping() {
    if (!this.ready) throw new Error('database unavailable');
  }
}

class MemoryRedis implements RedisService {
  readonly values = new Map<string, string>();
  ready = true;

  async connect() {}
  async get(key: string) { return this.values.get(key) ?? null; }
  async set(key: string, value: string) { this.values.set(key, value); }
  async sendCommand() { throw new Error('Rate-limit storage is disabled in tests.'); }
  async ping() {
    if (!this.ready) throw new Error('redis unavailable');
    return 'PONG';
  }
  async close() {}
}

describe('auth API', () => {
  let repository: MemoryRepository;
  let redis: MemoryRedis;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    repository = new MemoryRepository();
    redis = new MemoryRedis();
    app = createApp({ repository, redis, config });
  });

  it('requires consent before creating an account', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'A Student',
      email: 'student@example.test',
      password: 'a-long-test-password',
      consent: false,
    });

    expect(response.status).toBe(400);
    expect(repository.users.size).toBe(0);
  });

  it('registers, authenticates, and returns only public account fields', async () => {
    const registration = await request(app).post('/api/v1/auth/register').send({
      name: 'A Student',
      email: 'Student@Example.test',
      password: 'a-long-test-password',
      consent: true,
    });

    expect(registration.status).toBe(201);
    expect(registration.body.user.email).toBe('student@example.test');
    expect(registration.body.user.arm).toBe('random');
    expect(registration.body.user.passwordHash).toBeUndefined();

    const profile = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registration.body.token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.user.id).toBe(registration.body.user.id);
  });

  it('checks bcrypt passwords at login', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'A Student',
      email: 'student@example.test',
      password: 'a-long-test-password',
      consent: true,
    });

    const rejected = await request(app).post('/api/v1/auth/login').send({
      email: 'student@example.test',
      password: 'incorrect-password',
    });
    expect(rejected.status).toBe(401);

    const accepted = await request(app).post('/api/v1/auth/login').send({
      email: 'STUDENT@example.test',
      password: 'a-long-test-password',
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.token).toEqual(expect.any(String));
  });

  it('revokes an access token on logout', async () => {
    const registration = await request(app).post('/api/v1/auth/register').send({
      name: 'A Student',
      email: 'student@example.test',
      password: 'a-long-test-password',
      consent: true,
    });
    const authorization = `Bearer ${registration.body.token}`;

    const logout = await request(app).post('/api/v1/auth/logout').set('Authorization', authorization);
    expect(logout.status).toBe(204);
    const profile = await request(app).get('/api/v1/auth/me').set('Authorization', authorization);
    expect(profile.status).toBe(401);
  });

  it('rejects duplicate email and malformed requests', async () => {
    const body = {
      name: 'A Student',
      email: 'student@example.test',
      password: 'a-long-test-password',
      consent: true,
    };
    await request(app).post('/api/v1/auth/register').send(body).expect(201);
    await request(app).post('/api/v1/auth/register').send(body).expect(409);
    await request(app).post('/api/v1/auth/login').send({ email: 'bad', password: 'x' }).expect(400);
  });

  it('does not disclose invalid bearer tokens', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-token');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});
