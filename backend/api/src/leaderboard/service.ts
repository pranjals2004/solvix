import type { RedisService } from '../infra/redis';
import { leaderboardScore, solvedCountFromScore, weekStartFor } from './week';
import type { LeaderboardRepository, WeeklyLeaderboard } from './types';

const MERGE_SCORE_SCRIPT = `
local scale = tonumber(ARGV[1])
for i = 2, #ARGV, 2 do
  local member = ARGV[i]
  local incoming = tonumber(ARGV[i + 1])
  local current = redis.call('ZSCORE', KEYS[1], member)
  if not current or math.floor(tonumber(current) / scale) <= math.floor(incoming / scale) then
    redis.call('ZADD', KEYS[1], incoming, member)
  end
end
return #ARGV / 2
`;

function leaderboardKey(weekStart: string): string {
  return `lb:${weekStart}`;
}

function readPairs(raw: unknown): Array<{ userId: string; score: number }> {
  if (!Array.isArray(raw)) return [];
  const entries: Array<{ userId: string; score: number }> = [];
  for (let index = 0; index + 1 < raw.length; index += 2) {
    const userId = String(raw[index]);
    const score = Number(raw[index + 1]);
    if (userId && Number.isFinite(score)) entries.push({ userId, score });
  }
  return entries;
}

export class RedisLeaderboardService implements WeeklyLeaderboard {
  constructor(
    private readonly repository: LeaderboardRepository,
    private readonly redis: RedisService,
    private readonly timeZone = 'Asia/Kolkata',
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getWeekly(userId: string, limit: number) {
    const weekStart = weekStartFor(this.now(), this.timeZone);
    const records = await this.repository.listWeek(weekStart);
    await this.mergeScores(weekStart, records);
    const raw = await this.redis.sendCommand('ZREVRANGE', leaderboardKey(weekStart), '0', String(limit - 1), 'WITHSCORES');
    const names = new Map(records.map((record) => [record.userId, record.name]));
    const entries = readPairs(raw).map((entry, index) => ({
      userId: entry.userId,
      name: names.get(entry.userId) ?? 'Student',
      solvedCount: solvedCountFromScore(entry.score),
      rank: index + 1,
    }));
    const callerRank = await this.redis.sendCommand('ZREVRANK', leaderboardKey(weekStart), userId);
    const callerScore = await this.redis.sendCommand('ZSCORE', leaderboardKey(weekStart), userId);
    const caller = callerRank === null || callerScore === null
      ? null
      : { rank: Number(callerRank) + 1, solvedCount: solvedCountFromScore(String(callerScore)) };
    return { weekStart, entries, caller };
  }

  async getArchive(userId: string, weekStart: string, limit: number) {
    const [records, callerRecord] = await Promise.all([
      this.repository.listArchive(weekStart, limit),
      this.repository.getUserArchiveRank(userId, weekStart),
    ]);
    return {
      weekStart,
      entries: records.map((record) => ({
        userId: record.userId, name: record.name, solvedCount: record.solvedCount, rank: record.rank,
      })),
      caller: callerRecord ? { rank: callerRecord.rank, solvedCount: callerRecord.solvedCount } : null,
    };
  }

  async recordCount(userId: string, weekStart: string): Promise<void> {
    const record = await this.repository.getUserWeek(userId, weekStart);
    if (record) await this.mergeScores(weekStart, [record]);
  }

  async finalizeWeek(weekStart: string): Promise<void> {
    const records = await this.repository.listWeek(weekStart);
    const entries = records.map((record, index) => ({
      userId: record.userId, solvedCount: record.solvedCount, rank: index + 1,
    }));
    await this.repository.archiveWeek(weekStart, entries);
    await this.redis.sendCommand('DEL', leaderboardKey(weekStart));
  }

  async removeUserFromCurrentWeek(userId: string): Promise<void> {
    const weekStart = weekStartFor(this.now(), this.timeZone);
    await this.redis.sendCommand('ZREM', leaderboardKey(weekStart), userId);
  }

  async listFlaggedAccounts(limit: number) {
    return this.repository.listFlaggedUsers(limit);
  }

  private async mergeScores(weekStart: string, records: Array<{ userId: string; solvedCount: number; reachedCountAt: Date }>): Promise<void> {
    if (records.length === 0) return;
    const values = records.flatMap((record) => [
      record.userId,
      String(leaderboardScore(record.solvedCount, record.reachedCountAt, weekStart, this.timeZone)),
    ]);
    await this.redis.sendCommand(
      'EVAL', MERGE_SCORE_SCRIPT, '1', leaderboardKey(weekStart), '10000000000', ...values,
    );
  }
}
