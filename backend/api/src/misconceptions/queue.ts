import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { MisconceptionQueue } from './types';

export const MISCONCEPTION_QUEUE_NAME = 'solvix-misconception-clustering';

export class BullMisconceptionQueue implements MisconceptionQueue {
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue(MISCONCEPTION_QUEUE_NAME, {
      connection: new Redis(redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false }),
    });
    this.queue.on('error', () => {
      // API requests remain responsive; the queue exposes failures through BullMQ worker events.
    });
  }

  async enqueue(runId: string): Promise<void> {
    await this.queue.add(
      'cluster-run',
      { runId },
      {
        jobId: runId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 1_000,
      },
    );
  }

  async scheduleWeekly(timeZone: string): Promise<void> {
    await this.queue.upsertJobScheduler(
      `weekly-misconception-clustering-${timeZone}`,
      { pattern: '0 2 * * 1', tz: timeZone },
      {
        name: 'cluster-weekly',
        data: {},
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
      },
    );
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
