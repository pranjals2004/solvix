export const LEADERBOARD_SCORE_SCALE = 10_000_000_000;
export const MINIMUM_RANKED_ATTEMPT_SECONDS = 10;
export const SUBTHRESHOLD_FLAG_COUNT = 5;
export const SUBTHRESHOLD_FLAG_WINDOW_MINUTES = 10;
const WEEKDAY_OFFSET: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

export function weekStartFor(date: Date, timeZone = 'Asia/Kolkata'): string {
  if (!Number.isFinite(date.getTime())) throw new Error('A valid date is required.');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const weekday = WEEKDAY_OFFSET[values.weekday ?? ''];
  if (!year || !month || !day || weekday === undefined) throw new Error('Could not determine the local week.');
  return new Date(Date.UTC(year, month - 1, day - weekday)).toISOString().slice(0, 10);
}

export function isMondayDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}

export function leaderboardScore(solvedCount: number, reachedAt: Date, weekStart: string, timeZone = 'Asia/Kolkata'): number {
  if (!Number.isSafeInteger(solvedCount) || solvedCount < 1) throw new Error('Solved count must be a positive integer.');
  if (!Number.isFinite(reachedAt.getTime()) || !isMondayDate(weekStart)) throw new Error('A valid completion time and Monday week start are required.');
  const elapsedMilliseconds = Math.max(0, reachedAt.getTime() - localMidnightEpoch(weekStart, timeZone));
  const tieBreak = LEADERBOARD_SCORE_SCALE - 1 - Math.min(elapsedMilliseconds, LEADERBOARD_SCORE_SCALE - 1);
  return solvedCount * LEADERBOARD_SCORE_SCALE + tieBreak;
}

export function solvedCountFromScore(score: string | number): number {
  const numeric = Number(score);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric / LEADERBOARD_SCORE_SCALE);
}

export function isRankableCorrectAttempt(isCorrect: boolean, timeTakenSeconds: number): boolean {
  return isCorrect && Number.isFinite(timeTakenSeconds) && timeTakenSeconds >= MINIMUM_RANKED_ATTEMPT_SECONDS;
}

export function isImplausibleFastAttemptPattern(subthresholdAttempts: number): boolean {
  return Number.isInteger(subthresholdAttempts) && subthresholdAttempts >= SUBTHRESHOLD_FLAG_COUNT;
}

function localMidnightEpoch(weekStart: string, timeZone: string): number {
  const dateParts = weekStart.split('-').map(Number);
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error('Invalid week start.');
  }
  let epoch = Date.UTC(year, month - 1, day);
  const targetLocalAsUtc = epoch;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(epoch));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const renderedAsUtc = Date.UTC(
      Number(values.year), Number(values.month) - 1, Number(values.day),
      Number(values.hour), Number(values.minute), Number(values.second),
    );
    epoch += targetLocalAsUtc - renderedAsUtc;
  }
  return epoch;
}
