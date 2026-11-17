import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { runSyntheticSimulation } from './simulation';

const root = resolve(__dirname, '..');

async function main(): Promise<void> {
  const learnersPerArm = readInteger('SIMULATION_LEARNERS_PER_ARM', 27);
  const attemptsPerLearner = readInteger('SIMULATION_ATTEMPTS_PER_LEARNER', 30);
  const seed = readInteger('SIMULATION_SEED', 20261117);
  const attempts = runSyntheticSimulation({ learnersPerArm, attemptsPerLearner, seed });
  const headers = [
    'data_label',
    'seed',
    'learner_id',
    'arm',
    'true_skill',
    'confidence_bias',
    'attempt_no',
    'question_id',
    'confidence_raw',
    'is_correct',
    'skill_before',
    'skill_after',
    'question_before',
    'question_after',
  ];
  const csv =
    [
      headers.join(','),
      ...attempts.map((attempt) =>
        [
          attempt.dataLabel,
          attempt.seed,
          attempt.learnerId,
          attempt.arm,
          attempt.trueSkill,
          attempt.confidenceBias,
          attempt.attemptNo,
          attempt.questionId,
          attempt.confidence,
          attempt.correct,
          attempt.skillBefore.toFixed(4),
          attempt.skillAfter.toFixed(4),
          attempt.questionBefore.toFixed(4),
          attempt.questionAfter.toFixed(4),
        ].join(','),
      ),
    ].join('\n') + '\n';

  const outputPath = resolve(
    process.env.SYNTHETIC_SIMULATION_PATH ?? 'exports/synthetic-adaptive-simulation.csv',
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, csv, 'utf8');
  process.stdout.write(
    `Wrote ${attempts.length} synthetic attempts to ${outputPath}. No accounts or database rows were created.\n`,
  );
  process.stdout.write(
    'This deterministic practice-loop simulation is synthetic demo data and must not be reported as a pilot result.\n',
  );
}

function readInteger(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer.`);
  return parsed;
}

void main().catch((error: unknown) => {
  process.stderr.write(`Synthetic simulation failed: ${String(error)}\n`);
  process.exitCode = 1;
});
