import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../src/config/env';
import type { AuthRepository } from '../src/domain/user';
import { createApp } from '../src/app';
import { anonymizeDoubt } from '../src/misconceptions/anonymize';
import { MisconceptionClusteringService } from '../src/misconceptions/service';
import type { MisconceptionRepository } from '../src/misconceptions/types';
import type { RedisService } from '../src/infra/redis';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 3000,
  databaseUrl: 'postgresql://solvix:local@localhost:5432/solvix',
  redisUrl: 'redis://localhost:6379',
  jwtSecret: 'unit-test-key-that-is-long-enough-for-hmac-sha256',
  jwtIssuer: 'solvix-misconception-tests',
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

const topic = {
  id: randomUUID(),
  name: 'Recursion',
  slug: 'recursion',
  subjectId: randomUUID(),
  subjectName: 'Data Structures & Algorithms',
  subjectSlug: 'dsa',
};

describe('misconception anonymization and clustering service', () => {
  it('removes known names and both known and arbitrary email addresses', () => {
    const text = anonymizeDoubt({
      id: randomUUID(),
      text: 'I am Asha (asha@example.edu), please email friend@sample.org about recursion.',
      name: 'Asha',
      email: 'asha@example.edu',
    });
    expect(text).not.toContain('Asha');
    expect(text).not.toContain('asha@example.edu');
    expect(text).not.toContain('friend@sample.org');
    expect(text).toContain('[redacted name]');
  });

  it('sends anonymized text and persists member tags with topic-prefixed codes', async () => {
    const exemplarDoubtId = randomUUID();
    const doubtIds = [exemplarDoubtId, randomUUID(), randomUUID()];
    const completeTopicRun = vi.fn(async () => {});
    const failTopicRun = vi.fn(async () => {});
    const repository = {
      createQueuedRun: async () => {},
      failQueuedRun: async () => {},
      listTopics: async () => [topic],
      listDoubts: async () =>
        doubtIds.map((id, index) => ({
          id,
          text: `Asha confuses the recursive case ${index}.`,
          name: 'Asha',
          email: 'asha@example.edu',
        })),
      startTopicRun: async () => {},
      completeTopicRun,
      failTopicRun,
    } as unknown as MisconceptionRepository;
    const cluster = vi.fn(async () => ({
      assignments: doubtIds.map((doubtId) => ({ doubtId, clusterId: 0 })),
      clusters: [{ clusterId: 0, size: 3, exemplarDoubtIds: [exemplarDoubtId] }],
    }));
    const service = new MisconceptionClusteringService(repository, { cluster });

    const result = await service.run(randomUUID());

    expect(cluster.mock.calls[0]?.[0].every(({ text }) => !text.includes('Asha'))).toBe(true);
    expect(cluster.mock.calls[0]?.[0].every(({ text }) => !text.includes('asha@example.edu'))).toBe(
      true,
    );
    expect(completeTopicRun).toHaveBeenCalledWith(expect.any(String), topic, 3, [
      { clusterId: 0, size: 3, doubtIds, exemplarDoubtIds: [exemplarDoubtId] },
    ]);
    expect(result).toMatchObject({ topicsProcessed: 1, doubtsProcessed: 3, clustersFound: 1 });
    expect(failTopicRun).not.toHaveBeenCalled();
  });
});

describe('misconception review routes', () => {
  it('requires admin access to trigger clustering and exposes only labelled student hints', async () => {
    const userId = randomUUID();
    let queuedRunId: string | null = null;
    const cluster = {
      id: randomUUID(),
      runId: randomUUID(),
      clusterCode: 'DSA-C01',
      label: 'Confuses recursion base and recursive cases',
      size: 3,
      subjectId: topic.subjectId,
      subjectName: topic.subjectName,
      topicId: topic.id,
      topicName: topic.name,
      createdAt: new Date(),
      exemplars: [{ doubtId: randomUUID(), text: 'A redacted sample doubt.' }],
    };
    const repository = {
      createQueuedRun: async () => {},
      failQueuedRun: async () => {},
      listStudentHints: async () => [
        {
          clusterId: randomUUID(),
          label: 'Confuses base and recursive cases',
          topicId: topic.id,
          topicName: topic.name,
        },
      ],
      listAdminClusters: async () => [cluster],
      labelCluster: async (_clusterId: string, label: string) => ({ ...cluster, label }),
      getRunStatus: async () => [
        {
          topicId: topic.id,
          topicName: topic.name,
          status: 'queued' as const,
          doubtsProcessed: 0,
          clustersFound: 0,
          error: null,
          startedAt: new Date(),
          completedAt: null,
        },
      ],
    } as unknown as MisconceptionRepository;
    const app = createApp({
      repository: {} as AuthRepository,
      redis: { get: async () => null } as unknown as RedisService,
      config,
      misconceptionRepository: repository,
      misconceptionQueue: {
        enqueue: async (runId) => {
          queuedRunId = runId;
        },
        close: async () => {},
      },
    });
    const tokenFor = (role: 'student' | 'admin') =>
      jwt.sign({ role, arm: 'random' }, config.jwtSecret, {
        algorithm: 'HS256',
        subject: userId,
        jwtid: randomUUID(),
        issuer: config.jwtIssuer,
        expiresIn: '15m',
      });

    await request(app)
      .post('/api/v1/admin/misconceptions/run')
      .set('Authorization', `Bearer ${tokenFor('student')}`)
      .expect(403);
    const response = await request(app)
      .post('/api/v1/admin/misconceptions/run')
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .expect(202);
    expect(response.body).toMatchObject({ status: 'queued' });
    expect(queuedRunId).toBe(response.body.runId);
    const runStatus = await request(app)
      .get(`/api/v1/admin/misconceptions/runs/${response.body.runId}`)
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .expect(200);
    expect(runStatus.body.topics[0].status).toBe('queued');

    await request(app)
      .get('/api/v1/admin/misconceptions/clusters')
      .set('Authorization', `Bearer ${tokenFor('student')}`)
      .expect(403);
    const adminClusters = await request(app)
      .get('/api/v1/admin/misconceptions/clusters')
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .expect(200);
    expect(adminClusters.body.clusters[0].exemplars[0].text).toBe('A redacted sample doubt.');
    const labelled = await request(app)
      .patch(`/api/v1/admin/misconceptions/clusters/${cluster.id}`)
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .send({ label: 'Confuses base and recursive cases' })
      .expect(200);
    expect(labelled.body.cluster.label).toBe('Confuses base and recursive cases');

    const hints = await request(app)
      .get('/api/v1/misconceptions/hints')
      .set('Authorization', `Bearer ${tokenFor('student')}`)
      .expect(200);
    expect(hints.body.hints[0].label).toContain('Confuses');
  });
});
