import { describe, expect, it } from 'vitest';
import { RedisLeaderboardService } from '../src/leaderboard/service';
import { leaderboardScore } from '../src/leaderboard/week';
import type { RedisService } from '../src/infra/redis';
import type { LeaderboardRepository, WeeklyLeaderboardRecord } from '../src/leaderboard/types';

class FakeLeaderboardRedis implements RedisService {
  private readonly sets = new Map<string, Map<string, number>>();

  async connect() {}
  async get() { return null; }
  async set() {}
  async ping() { return 'PONG'; }
  async close() {}

  async sendCommand(...args: string[]) {
    const [command, ...parameters] = args;
    const key = command === 'EVAL' ? parameters[2] : parameters[0];
    if (!command || !key) throw new Error('Invalid Redis test command.');
    if (command === 'EVAL') {
      const scale = Number(parameters[3]);
      const set = this.sets.get(key) ?? new Map<string, number>();
      for (let index = 4; index + 1 < parameters.length; index += 2) {
        const member = parameters[index];
        const score = Number(parameters[index + 1]);
        if (!member || !Number.isFinite(score)) continue;
        const current = set.get(member);
        if (current === undefined || Math.floor(current / scale) <= Math.floor(score / scale)) set.set(member, score);
      }
      this.sets.set(key, set);
      return 0;
    }
    const sorted = [...(this.sets.get(key) ?? new Map()).entries()]
      .sort((left, right) => right[1] - left[1] || right[0].localeCompare(left[0]));
    if (command === 'ZREVRANGE') {
      const start = Number(parameters[1]);
      const stop = Number(parameters[2]);
      return sorted.slice(start, stop + 1).flatMap(([member, score]) => [member, String(score)]);
    }
    if (command === 'ZREVRANK') {
      const index = sorted.findIndex(([member]) => member === parameters[1]);
      return index < 0 ? null : index;
    }
    if (command === 'ZSCORE') {
      const score = this.sets.get(key)?.get(parameters[1] ?? '');
      return score === undefined ? null : String(score);
    }
    if (command === 'DEL') return this.sets.delete(key) ? 1 : 0;
    throw new Error(`Unsupported Redis command ${command}.`);
  }
}

describe('weekly leaderboard service', () => {
  it('repairs the Redis projection from durable records and reports the caller rank', async () => {
    const weekStart = '2026-11-16';
    const records: WeeklyLeaderboardRecord[] = [
      { userId: 'user-a', name: 'A', solvedCount: 3, reachedCountAt: new Date('2026-11-16T04:00:00Z') },
      { userId: 'user-b', name: 'B', solvedCount: 3, reachedCountAt: new Date('2026-11-16T04:02:00Z') },
      { userId: 'user-c', name: 'C', solvedCount: 2, reachedCountAt: new Date('2026-11-16T04:01:00Z') },
    ];
    const repository = {
      async listWeek() { return records; },
      async getUserWeek(userId: string) { return records.find((record) => record.userId === userId) ?? null; },
      async archiveWeek() {},
      async listArchive() { return []; },
      async getUserArchiveRank() { return null; },
      async listFlaggedUsers() { return []; },
    } satisfies LeaderboardRepository;
    const redis = new FakeLeaderboardRedis();
    const service = new RedisLeaderboardService(repository, redis, 'Asia/Kolkata', () => new Date('2026-11-18T10:00:00Z'));
    await service.recordCount('user-a', weekStart);
    const view = await service.getWeekly('user-b', 2);
    expect(view.entries.map((entry) => entry.userId)).toEqual(['user-a', 'user-b']);
    expect(view.entries.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(view.caller).toEqual({ rank: 2, solvedCount: 3 });
  });

  it('archives rank order and opens an empty Redis key for the next week', async () => {
    const archived: unknown[] = [];
    const repository = {
      async listWeek() { return [
        { userId: 'user-a', name: 'A', solvedCount: 4, reachedCountAt: new Date('2026-11-16T04:00:00Z') },
        { userId: 'user-b', name: 'B', solvedCount: 2, reachedCountAt: new Date('2026-11-16T04:00:00Z') },
      ]; },
      async getUserWeek() { return null; },
      async archiveWeek(weekStart: string, entries: Array<{ userId: string; solvedCount: number; rank: number }>) {
        archived.push({ weekStart, entries });
      },
      async listArchive() { return []; },
      async getUserArchiveRank() { return null; },
      async listFlaggedUsers() { return []; },
    } satisfies LeaderboardRepository;
    const redis = new FakeLeaderboardRedis();
    await redis.sendCommand('EVAL', '', '1', 'lb:2026-11-16', '10000000000', 'user-old',
      String(leaderboardScore(1, new Date('2026-11-16T05:00:00Z'), '2026-11-16')));
    const service = new RedisLeaderboardService(repository, redis);
    await service.finalizeWeek('2026-11-16');
    expect(archived[0]).toEqual({
      weekStart: '2026-11-16',
      entries: [
        { userId: 'user-a', solvedCount: 4, rank: 1 },
        { userId: 'user-b', solvedCount: 2, rank: 2 },
      ],
    });
    expect(await redis.sendCommand('ZREVRANGE', 'lb:2026-11-16', '0', '10', 'WITHSCORES')).toEqual([]);
  });
});
