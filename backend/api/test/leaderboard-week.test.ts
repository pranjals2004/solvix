import { describe, expect, it } from 'vitest';
import {
  isImplausibleFastAttemptPattern, isMondayDate, isRankableCorrectAttempt, leaderboardScore,
  solvedCountFromScore, weekStartFor,
} from '../src/leaderboard/week';

describe('weekly leaderboard scoring', () => {
  it('uses Monday boundaries in the configured Asia/Kolkata timezone', () => {
    expect(weekStartFor(new Date('2026-11-15T18:29:59.000Z'))).toBe('2026-11-09');
    expect(weekStartFor(new Date('2026-11-15T18:30:00.000Z'))).toBe('2026-11-16');
    expect(weekStartFor(new Date('2026-11-16T04:00:00.000Z'))).toBe('2026-11-16');
    expect(isMondayDate('2026-11-16')).toBe(true);
    expect(isMondayDate('2026-11-15')).toBe(false);
    expect(isMondayDate('2026-02-30')).toBe(false);
  });

  it('ranks count first, then the earlier time the current count was reached', () => {
    const weekStart = '2026-11-16';
    const early = leaderboardScore(4, new Date('2026-11-16T04:00:10.000Z'), weekStart);
    const late = leaderboardScore(4, new Date('2026-11-16T04:10:10.000Z'), weekStart);
    const threeCorrect = leaderboardScore(3, new Date('2026-11-16T04:00:00.000Z'), weekStart);
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(threeCorrect);
    expect(solvedCountFromScore(early)).toBe(4);
  });

  it('counts distinct correct questions with at least ten seconds and excludes other attempts', () => {
    expect(isRankableCorrectAttempt(true, 10)).toBe(true);
    expect(isRankableCorrectAttempt(true, 9)).toBe(false);
    expect(isRankableCorrectAttempt(false, 30)).toBe(false);
    expect(isRankableCorrectAttempt(true, Number.NaN)).toBe(false);
    expect(isImplausibleFastAttemptPattern(4)).toBe(false);
    expect(isImplausibleFastAttemptPattern(5)).toBe(true);
    expect(isImplausibleFastAttemptPattern(5.5)).toBe(false);
  });
});
