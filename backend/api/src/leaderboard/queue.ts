import { Queue } from 'bullmq';
import Redis from 'ioredis';

export const LEADERBOARD_QUEUE_NAME = 'solvix-weekly-leaderboard';

export class BullLeaderboardQueue {
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue(LEADERBOARD_QUEUE_NAME, {
      connection: new Redis(redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false }),
    });
    this.queue.on('error', () => {
      // BullMQ owns retrying scheduled jobs; API rankings remain readable from PostgreSQL.
    });
  }

  async scheduleWeeklyArchive(timeZone: string): Promise<void> {
    await this.queue.upsertJobScheduler(
      `weekly-archive-${timeZone}`,
      { pattern: '59 23 * * 0', tz: timeZone },
      { name: 'archive-week', data: {}, opts: { attempts: 5, backoff: { type: 'exponential', delay: 2000 } } },
    );
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
