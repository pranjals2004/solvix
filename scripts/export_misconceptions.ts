import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { loadConfig } from '../backend/api/src/config/env';
import { createPool } from '../backend/api/src/db/pool';
import { PostgresMisconceptionRepository } from '../backend/api/src/db/misconception-repository';

dotenv.config({ path: resolve(__dirname, '../.env') });

async function exportMisconceptions(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  try {
    const rows = await new PostgresMisconceptionRepository(pool).listLabeledExportRows();
    const headers = [
      'subject',
      'topic',
      'cluster_code',
      'label',
      'cluster_size',
      'total_doubts',
      'share_of_doubt_volume',
      'run_created_at',
    ];
    const csv =
      [
        headers.join(','),
        ...rows.map((row) =>
          [
            row.subjectName,
            row.topicName,
            row.clusterCode,
            row.label,
            row.clusterSize,
            row.totalDoubts,
            row.shareOfDoubtVolume,
            row.createdAt.toISOString(),
          ]
            .map(csvCell)
            .join(','),
        ),
      ].join('\n') + '\n';
    const outputPath = resolve(
      process.env.MISCONCEPTION_EXPORT_PATH ?? 'exports/labelled-misconceptions.csv',
    );
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, csv, 'utf8');
    process.stdout.write(`Exported ${rows.length} labelled clusters to ${outputPath}\n`);
  } finally {
    await pool.end();
  }
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

void exportMisconceptions().catch((error: unknown) => {
  process.stderr.write(`Misconception export failed: ${String(error)}\n`);
  process.exitCode = 1;
});
