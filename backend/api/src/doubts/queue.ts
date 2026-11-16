import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { DoubtQueue, QueueJobOptions } from './types';

export const DOUBT_QUEUE_NAME = 'solvix-doubt-resolution';

export class BullDoubtQueue implements DoubtQueue {
  private readonly queue: Queue<{ doubtId: string }>;

  constructor(redisUrl: string) {
    this.queue = new Queue(DOUBT_QUEUE_NAME, {
      connection: new Redis(redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false }),
    });
    this.queue.on('error', () => {
      // The application surfaces Redis availability through /ready and queue failures.
    });
  }

  async add(name: 'resolve', data: { doubtId: string }, options: QueueJobOptions): Promise<unknown> {
    return this.queue.add(name, data, options);
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
