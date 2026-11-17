export type WeeklyLeaderboardRecord = {
  userId: string;
  name: string;
  solvedCount: number;
  reachedCountAt: Date;
};

export type ArchivedLeaderboardEntry = {
  userId: string;
  name: string;
  solvedCount: number;
  rank: number;
};

export type FlaggedAccount = { userId: string; name: string; email: string; flaggedAt: Date };

export type LeaderboardEntry = {
  userId: string;
  name: string;
  solvedCount: number;
  rank: number;
};

export interface LeaderboardRepository {
  listWeek(weekStart: string): Promise<WeeklyLeaderboardRecord[]>;
  getUserWeek(userId: string, weekStart: string): Promise<WeeklyLeaderboardRecord | null>;
  archiveWeek(weekStart: string, entries: Array<{ userId: string; solvedCount: number; rank: number }>): Promise<void>;
  listArchive(weekStart: string, limit: number): Promise<ArchivedLeaderboardEntry[]>;
  getUserArchiveRank(userId: string, weekStart: string): Promise<ArchivedLeaderboardEntry | null>;
  listFlaggedUsers(limit: number): Promise<FlaggedAccount[]>;
}

export interface WeeklyLeaderboard {
  getWeekly(userId: string, limit: number): Promise<{
    weekStart: string;
    entries: LeaderboardEntry[];
    caller: { rank: number; solvedCount: number } | null;
  }>;
  getArchive(userId: string, weekStart: string, limit: number): Promise<{
    weekStart: string;
    entries: LeaderboardEntry[];
    caller: { rank: number; solvedCount: number } | null;
  }>;
  recordCount(userId: string, weekStart: string): Promise<void>;
  finalizeWeek(weekStart: string): Promise<void>;
  removeUserFromCurrentWeek(userId: string): Promise<void>;
  listFlaggedAccounts(limit: number): Promise<FlaggedAccount[]>;
}
