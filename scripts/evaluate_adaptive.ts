import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import type { ExperimentArm } from '../backend/api/src/domain/user';
import {
  summarizeAdaptiveExperiment,
  type AdaptiveExperimentOutcome,
} from '../backend/api/src/practice/evaluation';
import { loadConfig } from '../backend/api/src/config/env';
import { createPool } from '../backend/api/src/db/pool';

dotenv.config({ path: resolve(__dirname, '../.env') });

type AssignedStudentCount = { arm: ExperimentArm; count: string };
type SubmissionRow = {
  arm: ExperimentArm;
  user_id: string;
  confidence: number;
  correct: boolean;
  time_taken_sec: number;
};

async function evaluateAdaptiveExperiment(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  try {
    const [assignedResult, submissionsResult] = await Promise.all([
      pool.query<AssignedStudentCount>(
        `SELECT arm, COUNT(*)::text AS count
         FROM users WHERE role = 'student' GROUP BY arm`,
      ),
      pool.query<SubmissionRow>(
        `SELECT u.arm, s.user_id, s.confidence_raw AS confidence,
                s.is_correct AS correct, s.time_taken_sec
         FROM submissions s JOIN users u ON u.id = s.user_id
         WHERE u.role = 'student'
         ORDER BY s.created_at, s.id`,
      ),
    ]);

    const assignedStudents = Object.fromEntries(
      assignedResult.rows.map((row) => [row.arm, Number(row.count)]),
    ) as Partial<Record<ExperimentArm, number>>;
    const outcomes: AdaptiveExperimentOutcome[] = submissionsResult.rows.map(
      (row) => ({
        arm: row.arm,
        userId: row.user_id,
        confidence: row.confidence,
        correct: row.correct,
        timeTakenSec: row.time_taken_sec,
      }),
    );
    const summaries = summarizeAdaptiveExperiment(assignedStudents, outcomes);
    const generatedAt = new Date().toISOString();
    const headers = [
      'arm',
      'registered_students',
      'participants',
      'attempts',
      'correct',
      'accuracy',
      'mean_time_seconds',
      'median_time_seconds',
      'ece',
      'calibration_attempts',
      'generated_at',
    ];
    const csv =
      [
        headers.join(','),
        ...summaries.map((summary) =>
          [
            summary.arm,
            summary.registeredStudents,
            summary.participants,
            summary.attempts,
            summary.correct,
            formatMetric(summary.accuracy),
            formatMetric(summary.meanTimeSec),
            formatMetric(summary.medianTimeSec),
            formatMetric(summary.ece),
            summary.calibrationAttempts,
            generatedAt,
          ].join(','),
        ),
      ].join('\n') + '\n';

    const outputPath = resolve(
      process.env.ADAPTIVE_EVALUATION_PATH ?? 'exports/adaptive-evaluation.csv',
    );
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, csv, 'utf8');
    process.stdout.write(
      `Exported descriptive adaptive-practice metrics from ${outcomes.length} stored attempts to ${outputPath}.\n`,
    );
    process.stdout.write(
      'Metrics are observational summaries by assigned arm; they do not establish causal superiority.\n',
    );
  } finally {
    await pool.end();
  }
}

function formatMetric(value: number | null): string {
  return value === null ? '' : value.toFixed(4);
}

void evaluateAdaptiveExperiment().catch((error: unknown) => {
  process.stderr.write(`Adaptive evaluation failed: ${String(error)}\n`);
  process.exitCode = 1;
});
