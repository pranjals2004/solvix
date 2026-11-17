import type { ExperimentArm } from '../backend/api/src/domain/user';
import { calculateElo, expectedScore } from '../backend/api/src/practice/elo';
import { selectNextQuestion } from '../backend/api/src/practice/selection';

export const SIMULATION_ARMS: ExperimentArm[] = ['random', 'standard_elo', 'conf_elo'];

const QUESTION_COUNT = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const TRUE_SKILLS = [800, 1000, 1200] as const;
const CONFIDENCE_BIASES = [-1, 0, 1] as const;

export type SimulationOptions = {
  learnersPerArm: number;
  attemptsPerLearner: number;
  seed: number;
};

export type SimulatedAttempt = {
  dataLabel: 'SYNTHETIC_NOT_RESEARCH_DATA';
  seed: number;
  learnerId: string;
  arm: ExperimentArm;
  trueSkill: number;
  confidenceBias: number;
  attemptNo: number;
  questionId: string;
  confidence: number;
  correct: boolean;
  skillBefore: number;
  skillAfter: number;
  questionBefore: number;
  questionAfter: number;
};

/**
 * Exercise the practice selection, confidence, and Elo loop in memory.
 * It deliberately does not create accounts or write to the real database.
 */
export function runSyntheticSimulation(options: SimulationOptions): SimulatedAttempt[] {
  validateOptions(options);
  const random = createSeededRandom(options.seed);
  const attempts: SimulatedAttempt[] = [];
  const questionBank = Array.from({ length: QUESTION_COUNT }, (_, index) => ({
    id: `SYN-Q-${String(index + 1).padStart(3, '0')}`,
    trueDifficulty: 700 + index * 10,
  }));

  for (const arm of SIMULATION_ARMS) {
    for (let learnerIndex = 0; learnerIndex < options.learnersPerArm; learnerIndex += 1) {
      const trueSkill = TRUE_SKILLS[learnerIndex % TRUE_SKILLS.length] ?? TRUE_SKILLS[0];
      const confidenceBias =
        CONFIDENCE_BIASES[
          Math.floor(learnerIndex / TRUE_SKILLS.length) % CONFIDENCE_BIASES.length
        ] ?? 0;
      const learnerId = `synthetic-${arm}-${String(learnerIndex + 1).padStart(3, '0')}`;
      const questionRatings = new Map(
        questionBank.map((question) => [question.id, question.trueDifficulty]),
      );
      const lastAttemptAt = new Map<string, Date>();
      let skillRating = 1000;

      for (let attemptIndex = 0; attemptIndex < options.attemptsPerLearner; attemptIndex += 1) {
        const now = new Date(attemptIndex * 8 * DAY_MS);
        const candidates = questionBank.map((question) => ({
          id: question.id,
          difficultyRating: questionRatings.get(question.id) ?? question.trueDifficulty,
          lastAttemptAt: lastAttemptAt.get(question.id) ?? null,
          hasPendingResurface: false,
        }));
        const selected = selectNextQuestion(candidates, {
          arm,
          skillRating,
          epsilon: 200,
          sigma: 25,
          now,
          random,
        });
        if (!selected) throw new Error(`No synthetic question available for ${learnerId}.`);

        const question = questionBank.find((item) => item.id === selected.id);
        if (!question)
          throw new Error(`Selected question ${selected.id} is missing from the synthetic bank.`);

        const probabilityCorrect = expectedScore(trueSkill, question.trueDifficulty);
        const correct = random() < probabilityCorrect;
        const confidence = syntheticConfidence(probabilityCorrect, confidenceBias, random);
        const update = calculateElo({
          skillRating,
          questionRating: selected.difficultyRating,
          outcome: correct ? 1 : 0,
          confidence,
          arm: arm === 'conf_elo' ? 'conf_elo' : 'standard_elo',
        });

        attempts.push({
          dataLabel: 'SYNTHETIC_NOT_RESEARCH_DATA',
          seed: options.seed,
          learnerId,
          arm,
          trueSkill,
          confidenceBias,
          attemptNo: attemptIndex + 1,
          questionId: selected.id,
          confidence,
          correct,
          skillBefore: update.skillBefore,
          skillAfter: update.skillAfter,
          questionBefore: update.questionBefore,
          questionAfter: update.questionAfter,
        });

        skillRating = update.skillAfter;
        questionRatings.set(selected.id, update.questionAfter);
        lastAttemptAt.set(selected.id, now);
      }
    }
  }

  return attempts;
}

function syntheticConfidence(
  probabilityCorrect: number,
  bias: number,
  random: () => number,
): number {
  const base = Math.round(1 + probabilityCorrect * 4);
  const jitter = random() < 0.1 ? (random() < 0.5 ? -1 : 1) : 0;
  return Math.max(1, Math.min(5, base + bias + jitter));
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function validateOptions(options: SimulationOptions): void {
  if (
    !Number.isInteger(options.learnersPerArm) ||
    options.learnersPerArm < 9 ||
    options.learnersPerArm % 9 !== 0
  ) {
    throw new Error(
      'Learners per arm must be a positive multiple of 9 to balance synthetic profiles.',
    );
  }
  if (
    !Number.isInteger(options.attemptsPerLearner) ||
    options.attemptsPerLearner < 1 ||
    options.attemptsPerLearner > QUESTION_COUNT
  ) {
    throw new Error(`Attempts per learner must be between 1 and ${QUESTION_COUNT}.`);
  }
  if (!Number.isInteger(options.seed) || options.seed < 0) {
    throw new Error('Simulation seed must be a nonnegative integer.');
  }
}
