import type { ExperimentArm } from '../domain/user';

export type EloInput = {
  skillRating: number;
  questionRating: number;
  outcome: 0 | 1;
  confidence: number;
  arm: ExperimentArm;
};

export type EloOptions = {
  k?: number;
  gamma?: number;
  weightingVariant?: 'off' | 'calibration_bias';
  alpha?: number;
  beta?: number;
};

export type EloResult = {
  expected: number;
  confidenceProbability: number;
  calibrationError: number;
  kEffective: number;
  skillBefore: number;
  skillAfter: number;
  questionBefore: number;
  questionAfter: number;
};

const DEFAULT_K = 32;
const DEFAULT_GAMMA = 0.5;

export function expectedScore(skillRating: number, questionRating: number): number {
  validateFinite('Skill rating', skillRating);
  validateFinite('Question rating', questionRating);
  return 1 / (1 + 10 ** ((questionRating - skillRating) / 400));
}

export function calculateElo(input: EloInput, options: EloOptions = {}): EloResult {
  validateFinite('Skill rating', input.skillRating);
  validateFinite('Question rating', input.questionRating);
  if (input.outcome !== 0 && input.outcome !== 1) throw new Error('Outcome must be 0 or 1.');
  if (!Number.isInteger(input.confidence) || input.confidence < 1 || input.confidence > 5) {
    throw new Error('Confidence must be an integer between 1 and 5.');
  }
  const k = options.k ?? DEFAULT_K;
  const gamma = options.gamma ?? DEFAULT_GAMMA;
  const alpha = options.alpha ?? 0.5;
  const beta = options.beta ?? 0.5;
  for (const [label, value] of [
    ['K', k],
    ['gamma', gamma],
    ['alpha', alpha],
    ['beta', beta],
  ] as const) {
    validateFinite(label, value);
    if (value < 0) throw new Error(`${label} must be nonnegative.`);
  }

  const expected = expectedScore(input.skillRating, input.questionRating);
  const confidenceProbability = (input.confidence - 1) / 4;
  const calibrationError = Math.abs(input.outcome - confidenceProbability);
  let kEffective = k;
  if (input.arm === 'conf_elo') {
    if (options.weightingVariant === 'calibration_bias') {
      const weighting = confidenceBiasWeight(
        confidenceProbability,
        input.outcome,
        expected,
        alpha,
        beta,
      );
      kEffective = k * weighting;
    } else {
      kEffective = k * (1 + gamma * calibrationError);
    }
  }

  const adjustment = kEffective * (input.outcome - expected);
  return {
    expected,
    confidenceProbability,
    calibrationError,
    kEffective,
    skillBefore: input.skillRating,
    skillAfter: input.skillRating + adjustment,
    questionBefore: input.questionRating,
    questionAfter: input.questionRating - adjustment,
  };
}

/** Optional W(C,S,E): weight wrong overconfidence by alpha and correct underconfidence by beta. */
export function confidenceBiasWeight(
  confidenceProbability: number,
  outcome: 0 | 1,
  expected: number,
  alpha = 0.5,
  beta = 0.5,
): number {
  validateFinite('Confidence probability', confidenceProbability);
  validateFinite('Expected score', expected);
  validateFinite('alpha', alpha);
  validateFinite('beta', beta);
  if (confidenceProbability < 0 || confidenceProbability > 1 || expected < 0 || expected > 1) {
    throw new Error('Confidence probability and expected score must be between 0 and 1.');
  }
  if (outcome !== 0 && outcome !== 1) throw new Error('Outcome must be 0 or 1.');
  if (alpha < 0 || beta < 0) throw new Error('Weight parameters must be nonnegative.');
  const directionalBias =
    outcome === 0
      ? alpha * Math.max(0, confidenceProbability - expected)
      : beta * Math.max(0, expected - confidenceProbability);
  return 1 + directionalBias;
}

function validateFinite(label: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}
