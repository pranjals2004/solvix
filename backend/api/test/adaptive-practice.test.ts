import { describe, expect, it } from 'vitest';
import { calculateElo, confidenceBiasWeight, expectedScore } from '../src/practice/elo';
import { expectedCalibrationError } from '../src/practice/ece';
import { selectNextQuestion } from '../src/practice/selection';

describe('confidence-weighted Elo', () => {
  it('computes the expected probability and conserves total rating under standard Elo', () => {
    expect(expectedScore(1000, 1000)).toBe(0.5);
    const result = calculateElo({
      skillRating: 1000,
      questionRating: 1000,
      outcome: 1,
      confidence: 3,
      arm: 'standard_elo',
    });
    expect(result.skillAfter + result.questionAfter).toBeCloseTo(2000);
    expect(result.skillAfter).toBeGreaterThan(1000);
  });

  it('rewards a correct answer on a harder question with a larger skill increase', () => {
    const hard = calculateElo({
      skillRating: 1000,
      questionRating: 1200,
      outcome: 1,
      confidence: 3,
      arm: 'standard_elo',
    });
    const easy = calculateElo({
      skillRating: 1000,
      questionRating: 800,
      outcome: 1,
      confidence: 3,
      arm: 'standard_elo',
    });
    expect(hard.skillAfter - 1000).toBeGreaterThan(easy.skillAfter - 1000);
  });

  it('increases the update for a confidently wrong answer and conserves the pair total', () => {
    const confident = calculateElo({
      skillRating: 1000,
      questionRating: 1000,
      outcome: 0,
      confidence: 5,
      arm: 'conf_elo',
    });
    const uncertain = calculateElo({
      skillRating: 1000,
      questionRating: 1000,
      outcome: 0,
      confidence: 1,
      arm: 'conf_elo',
    });
    expect(confident.kEffective).toBe(48);
    expect(confident.kEffective).toBeGreaterThan(uncertain.kEffective);
    expect(confident.skillAfter + confident.questionAfter).toBeCloseTo(2000);
  });

  it('keeps the optional alpha/beta weighting variant explicit and testable', () => {
    expect(confidenceBiasWeight(1, 0, 0.5, 0.5, 0.5)).toBe(1.25);
    expect(confidenceBiasWeight(0, 1, 0.5, 0.5, 0.5)).toBe(1.25);
  });
});

describe('expected calibration error', () => {
  it('calculates confidence-accuracy gap and handles empty data', () => {
    const result = expectedCalibrationError([
      { confidence: 5, outcome: true },
      { confidence: 5, outcome: false },
    ]);
    expect(result.count).toBe(2);
    expect(result.ece).toBeCloseTo(0.5);
    expect(expectedCalibrationError([])).toMatchObject({ count: 0, ece: 0 });
  });
});

describe('adaptive practice selection', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const options = { skillRating: 1000, epsilon: 200, sigma: 25, now, random: () => 0.5 };

  it('selects randomly for the random arm', () => {
    const result = selectNextQuestion(
      [
        { id: 'one', difficultyRating: 1000, lastAttemptAt: null, hasPendingResurface: false },
        { id: 'two', difficultyRating: 1500, lastAttemptAt: null, hasPendingResurface: false },
      ],
      { ...options, arm: 'random' },
    );
    expect(result?.id).toBe('two');
  });

  it('selects within the adaptive rating window and skips queued and recently seen questions', () => {
    const result = selectNextQuestion(
      [
        { id: 'queued', difficultyRating: 1000, lastAttemptAt: null, hasPendingResurface: true },
        {
          id: 'recent',
          difficultyRating: 1000,
          lastAttemptAt: new Date('2026-11-16T12:00:00Z'),
          hasPendingResurface: false,
        },
        { id: 'unseen', difficultyRating: 1150, lastAttemptAt: null, hasPendingResurface: false },
        { id: 'far', difficultyRating: 1600, lastAttemptAt: null, hasPendingResurface: false },
      ],
      { ...options, arm: 'standard_elo' },
    );
    expect(result?.id).toBe('unseen');
  });

  it('returns null when all candidates are awaiting resurfacing', () => {
    expect(
      selectNextQuestion(
        [{ id: 'queued', difficultyRating: 1000, lastAttemptAt: null, hasPendingResurface: true }],
        { ...options, arm: 'conf_elo' },
      ),
    ).toBeNull();
  });
});
