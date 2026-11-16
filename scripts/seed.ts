import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import type { PoolClient } from 'pg';
import { ContentService } from '../backend/api/src/content/service';
import { MlServiceEmbeddingClient } from '../backend/api/src/content/embedding-client';
import type { QuestionInput } from '../backend/api/src/content/types';
import { loadConfig } from '../backend/api/src/config/env';
import { createPool } from '../backend/api/src/db/pool';
import { PostgresContentRepository } from '../backend/api/src/db/content-repository';

dotenv.config({ path: resolve(__dirname, '../.env') });

const subjectSeeds = [
  {
    name: 'Data Structures & Algorithms', slug: 'dsa',
    topics: [{ name: 'Data Structures', slug: 'data-structures' }, { name: 'Algorithms', slug: 'algorithms' }],
  },
  {
    name: 'Operating Systems', slug: 'operating-systems',
    topics: [{ name: 'Processes and Threads', slug: 'processes-threads' }, { name: 'Memory Management', slug: 'memory-management' }],
  },
  {
    name: 'Database Management Systems', slug: 'dbms',
    topics: [{ name: 'Relational Model', slug: 'relational-model' }, { name: 'Transactions', slug: 'transactions' }],
  },
  {
    name: 'Computer Networks', slug: 'computer-networks',
    topics: [{ name: 'Network Layers', slug: 'network-layers' }, { name: 'Transport Protocols', slug: 'transport-protocols' }],
  },
  {
    name: 'Theory of Computation', slug: 'theory-of-computation',
    topics: [{ name: 'Finite Automata', slug: 'finite-automata' }, { name: 'Context-Free Grammars', slug: 'context-free-grammars' }],
  },
];

async function seed() {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  const client = await pool.connect();
  try {
    const topicIds = await ensureSubjectsAndTopics(client);
    const questions: Array<{ id: string; input: QuestionInput }> = [];
    for (const subject of subjectSeeds) {
      for (let index = 1; index <= 10; index += 1) {
        const topic = subject.topics[(index - 1) % subject.topics.length]!;
        const topicId = topicIds.get(`${subject.slug}/${topic.slug}`);
        if (!topicId) throw new Error(`Seed topic was not created: ${subject.slug}/${topic.slug}`);
        const reference = `${subject.slug}-placeholder-${String(index).padStart(2, '0')}`;
        questions.push({
          id: deterministicUuid(reference),
          input: {
            subjectId: topicIds.get(`${subject.slug}/__subject__`)!,
            topicId,
            type: 'mcq',
            statementLatex: `[SYNTHETIC PLACEHOLDER ${reference}] Replace this text with reviewed, licensed ${subject.name} question content before release. This record exists only to exercise content browsing and import flows.`,
            optionsJson: ['Placeholder option A', 'Placeholder option B', 'Placeholder option C', 'Placeholder option D'],
            correctAnswerJson: { selected: 'A', syntheticPlaceholder: true },
            natTolerance: null,
            solutionLatex: `SYNTHETIC PLACEHOLDER SOLUTION for ${reference}. Replace with an author-reviewed worked solution before release.`,
            isPyq: false,
            pyqYear: null,
            difficultyRating: 1000,
          },
        });
      }
    }

    const repository = new PostgresContentRepository(pool);
    const content = new ContentService(repository, new MlServiceEmbeddingClient(config.mlServiceUrl));
    const result = await content.importContent(questions, []);
    process.stdout.write(`Seeded ${result.questions} clearly labelled synthetic placeholder questions.\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

async function ensureSubjectsAndTopics(client: PoolClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  await client.query('BEGIN');
  try {
    for (const subject of subjectSeeds) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO subjects (name, slug) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [subject.name, subject.slug],
      );
      const subjectId = result.rows[0]!.id;
      ids.set(`${subject.slug}/__subject__`, subjectId);
      for (const topic of subject.topics) {
        const topicResult = await client.query<{ id: string }>(
          `INSERT INTO topics (subject_id, name, slug) VALUES ($1, $2, $3)
           ON CONFLICT (subject_id, slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [subjectId, topic.name, topic.slug],
        );
        ids.set(`${subject.slug}/${topic.slug}`, topicResult.rows[0]!.id);
      }
    }
    await client.query('COMMIT');
    return ids;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

function deterministicUuid(value: string): string {
  const namespace = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');
  const bytes = createHash('sha1').update(namespace).update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

void seed().catch((error: unknown) => {
  process.stderr.write(`Seed failed: ${String(error)}\n`);
  process.exitCode = 1;
});
