import Redis from 'ioredis';

export type RedisValue = boolean | number | string | null;

export interface RedisService {
  connect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiresInSeconds: number): Promise<void>;
  sendCommand(...args: string[]): Promise<RedisValue | RedisValue[]>;
  ping(): Promise<string>;
  close(): Promise<void>;
}

export class IoredisService implements RedisService {
  private readonly client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
    });
    this.client.on('error', (_error) => {
      // Connection state is surfaced by /ready; consume emitted errors to avoid unhandled events.
    });
  }

  async connect(): Promise<void> {
    if (this.client.status === 'wait') await this.client.connect();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, expiresInSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', expiresInSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async sendCommand(...args: string[]): Promise<RedisValue | RedisValue[]> {
    const [command, ...parameters] = args;
    if (!command) throw new Error('Redis command is required.');
    return await this.client.call(command, ...parameters) as RedisValue | RedisValue[];
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async close(): Promise<void> {
    if (this.client.status === 'wait') {
      this.client.disconnect();
      return;
    }
    await this.client.quit();
  }
}
