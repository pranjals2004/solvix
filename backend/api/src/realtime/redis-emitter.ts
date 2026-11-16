import Redis from 'ioredis';
import { Emitter } from '@socket.io/redis-emitter';
import { socketUserRoom } from './socket-server';
import type { DoubtEventEmitter } from '../doubts/resolver';

export class RedisDoubtEmitter implements DoubtEventEmitter {
  private readonly client: Redis;
  private readonly emitter: Emitter;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.client.on('error', () => {
      // The worker retries through BullMQ; status polling remains the fallback.
    });
    this.emitter = new Emitter(this.client);
  }

  emitToUser(userId: string, event: 'doubt:updated', payload: unknown): void {
    this.emitter.to(socketUserRoom(userId)).emit(event, payload);
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
