import { describe, expect, it } from 'vitest';
import { runSyntheticSimulation } from '../../../scripts/simulation';

describe('synthetic adaptive simulation', () => {
  it('runs all three practice arms with balanced labelled synthetic profiles', () => {
    const attempts = runSyntheticSimulation({
      learnersPerArm: 9,
      attemptsPerLearner: 10,
      seed: 42,
    });

    expect(attempts).toHaveLength(270);
    expect(new Set(attempts.map((attempt) => attempt.arm))).toEqual(
      new Set(['random', 'standard_elo', 'conf_elo']),
    );
    expect(new Set(attempts.map((attempt) => attempt.learnerId))).toHaveLength(27);
    expect(attempts.every((attempt) => attempt.dataLabel === 'SYNTHETIC_NOT_RESEARCH_DATA')).toBe(
      true,
    );
    expect(attempts.every((attempt) => attempt.confidence >= 1 && attempt.confidence <= 5)).toBe(
      true,
    );
    expect(attempts.every((attempt) => attempt.questionId.startsWith('SYN-Q-'))).toBe(true);

    for (const arm of ['random', 'standard_elo', 'conf_elo'] as const) {
      const profiles = attempts
        .filter((attempt) => attempt.arm === arm)
        .map((attempt) => `${attempt.trueSkill}:${attempt.confidenceBias}`);
      expect(new Set(profiles)).toHaveLength(9);
    }
  });

  it('produces reproducible outcomes for a fixed seed', () => {
    const options = { learnersPerArm: 9, attemptsPerLearner: 5, seed: 1234 };
    expect(runSyntheticSimulation(options)).toEqual(runSyntheticSimulation(options));
  });

  it('rejects learner counts that would unbalance skill and confidence profiles', () => {
    expect(() =>
      runSyntheticSimulation({ learnersPerArm: 10, attemptsPerLearner: 5, seed: 1 }),
    ).toThrow('multiple of 9');
  });
});
