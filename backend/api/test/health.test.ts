import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { AppConfig } from '../src/config/env';
import type { AuthRepository } from '../src/domain/user';
import type { RedisService } from '../src/infra/redis';

const config: AppConfig = {
  nodeEnv: 'test', port: 3000,
  databaseUrl: 'postgresql://solvix:local@localhost:5432/solvix',
  redisUrl: 'redis://localhost:6379',
  jwtSecret: 'unit-test-key-that-is-long-enough-for-hmac-sha256',
  jwtIssuer: 'solvix-tests', jwtAccessTtl: '15m', bcryptRounds: 4,
  corsOrigins: [],
  mlServiceUrl: 'http://localhost:8000',
  s3Endpoint: 'http://localhost:9000', s3PublicEndpoint: 'http://10.0.2.2:9000', s3Region: 'us-east-1', s3Bucket: 'test',
  s3AccessKey: 'test-key', s3SecretKey: 'test-secret',
};

function buildApp(available: boolean) {
  const repository = {
    async createStudent() { throw new Error('unused'); },
    async findByEmail() { return null; },
    async findById() { return null; },
    async ping() { if (!available) throw new Error('database down'); },
  } satisfies AuthRepository;
  const redis = {
    async connect() {},
    async get() { return null; },
    async set() {},
    async sendCommand() { throw new Error('Rate-limit storage is disabled in tests.'); },
    async ping() { if (!available) throw new Error('redis down'); return 'PONG'; },
    async close() {},
  } satisfies RedisService;
  return createApp({ repository, redis, config });
}

describe('health endpoints', () => {
  it('reports liveness without checking dependencies', async () => {
    const response = await request(buildApp(false)).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('reports readiness only when Postgres and Redis are available', async () => {
    const ready = await request(buildApp(true)).get('/ready');
    expect(ready.status).toBe(200);

    const unavailable = await request(buildApp(false)).get('/ready');
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.dependencies).toEqual({ postgres: 'unavailable', redis: 'unavailable' });
  });
});
