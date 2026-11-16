import type { ExperimentArm } from '../domain/user';

export type QuestionCandidate = {
  id: string;
  difficultyRating: number;
  lastAttemptAt: Date | null;
  hasPendingResurface: boolean;
};

export type SelectionOptions = {
  arm: ExperimentArm;
  skillRating: number;
  epsilon: number;
  sigma: number;
  now?: Date;
  recentWindowDays?: number;
  random?: () => number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function selectNextQuestion(
  candidates: QuestionCandidate[],
  options: SelectionOptions,
): QuestionCandidate | null {
  if (candidates.length === 0) return null;
  validateOptions(options);
  const random = options.random ?? Math.random;
  const now = (options.now ?? new Date()).getTime();
  const available = candidates.filter((candidate) => !candidate.hasPendingResurface);
  if (available.length === 0) return null;
  const recentThreshold = now - (options.recentWindowDays ?? 7) * DAY_MS;
  const unseen = available.filter((candidate) =>
    candidate.lastAttemptAt === null || candidate.lastAttemptAt.getTime() < recentThreshold,
  );
  const pool = unseen.length > 0 ? unseen : available;
  if (options.arm === 'random') return pick(pool, random);

  const inWindow = pool.filter((candidate) =>
    Math.abs(candidate.difficultyRating - options.skillRating) <= options.epsilon,
  );
  let adaptivePool = inWindow;
  if (adaptivePool.length === 0) {
    const nearestGap = Math.min(...pool.map((candidate) => Math.abs(candidate.difficultyRating - options.skillRating)));
    adaptivePool = pool.filter((candidate) =>
      Math.abs(candidate.difficultyRating - options.skillRating) === nearestGap,
    );
  }
  const target = options.skillRating + gaussian(random) * options.sigma;
  const closestDistance = Math.min(...adaptivePool.map((candidate) => Math.abs(candidate.difficultyRating - target)));
  const closest = adaptivePool.filter((candidate) =>
    Math.abs(candidate.difficultyRating - target) === closestDistance,
  );
  return pick(closest, random);
}

function gaussian(random: () => number): number {
  const first = Math.max(Number.EPSILON, random());
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function pick<T>(values: T[], random: () => number): T {
  const index = Math.min(values.length - 1, Math.floor(random() * values.length));
  const selected = values[index];
  if (selected === undefined) throw new Error('Cannot select from an empty candidate list.');
  return selected;
}

function validateOptions(options: SelectionOptions): void {
  for (const [label, value] of [
    ['skill rating', options.skillRating], ['epsilon', options.epsilon], ['sigma', options.sigma],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and nonnegative.`);
  }
}
