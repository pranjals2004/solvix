import type { ExperimentArm } from '../domain/user';
import { expectedCalibrationError, type CalibrationObservation } from './ece';

export type AdaptiveExperimentOutcome = {
  arm: ExperimentArm;
  userId: string;
  confidence: number;
  correct: boolean;
  timeTakenSec: number;
};

export type AdaptiveArmSummary = {
  arm: ExperimentArm;
  registeredStudents: number;
  participants: number;
  attempts: number;
  correct: number;
  accuracy: number | null;
  meanTimeSec: number | null;
  medianTimeSec: number | null;
  ece: number | null;
  calibrationAttempts: number;
};

const experimentArms: ExperimentArm[] = ['random', 'standard_elo', 'conf_elo'];

/** Summarize persisted learner outcomes by assigned arm without exposing identities. */
export function summarizeAdaptiveExperiment(
  registeredStudentsByArm: Partial<Record<ExperimentArm, number>>,
  outcomes: AdaptiveExperimentOutcome[],
): AdaptiveArmSummary[] {
  return experimentArms.map((arm) => {
    const armOutcomes = outcomes.filter((outcome) => outcome.arm === arm);
    const correct = armOutcomes.filter((outcome) => outcome.correct).length;
    const observations: CalibrationObservation[] = armOutcomes.map((outcome) => ({
      confidence: outcome.confidence,
      outcome: outcome.correct,
    }));
    const attempts = armOutcomes.length;
    const times = armOutcomes.map((outcome) => outcome.timeTakenSec);

    return {
      arm,
      registeredStudents: registeredStudentsByArm[arm] ?? 0,
      participants: new Set(armOutcomes.map((outcome) => outcome.userId)).size,
      attempts,
      correct,
      accuracy: attempts === 0 ? null : correct / attempts,
      meanTimeSec:
        attempts === 0 ? null : times.reduce((total, time) => total + time, 0) / attempts,
      medianTimeSec: median(times),
      ece: attempts === 0 ? null : expectedCalibrationError(observations).ece,
      calibrationAttempts: attempts,
    };
  });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  return sorted.length % 2 === 0 ? ((lower ?? 0) + (upper ?? 0)) / 2 : (upper ?? null);
}
