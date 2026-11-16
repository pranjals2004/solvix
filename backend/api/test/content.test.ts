import { describe, expect, it } from 'vitest';
import { chunkText } from '../src/content/chunker';
import { MlServiceEmbeddingClient } from '../src/content/embedding-client';
import { parseImportBody } from '../src/content/import-parser';
import type { ContentService } from '../src/content/service';
import { PostgresContentRepository } from '../src/db/content-repository';

const subjectId = '00000000-0000-4000-8000-000000000001';
const topicId = '00000000-0000-4000-8000-000000000002';
const questionId = '00000000-0000-4000-8000-000000000003';

describe('content chunking', () => {
  it('normalizes whitespace, overlaps chunks, and handles empty input', () => {
    const source = `${'a'.repeat(125)} ${'b'.repeat(125)} ${'c'.repeat(125)}`;
    const chunks = chunkText(source, 140, 20);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toContain('a'.repeat(125));
    expect(chunkText('  \r\n  ')).toEqual([]);
    expect(() => chunkText('text', 100, 100)).toThrow(RangeError);
  });
});

describe('embedding client', () => {
  it('splits requests to respect the ML service batch limit', async () => {
    const batches: number[] = [];
    const client = new MlServiceEmbeddingClient('http://ml.test', async (_input, init) => {
      const payload = JSON.parse(String(init?.body)) as { texts: string[] };
      batches.push(payload.texts.length);
      return new Response(JSON.stringify({
        dimensions: 384,
        embeddings: payload.texts.map(() => Array.from({ length: 384 }, () => 0.25)),
      }), { status: 200 });
    });

    const vectors = await client.embed(Array.from({ length: 35 }, (_, index) => `content ${index}`));
    expect(batches).toEqual([32, 3]);
    expect(vectors).toHaveLength(35);
    expect(vectors[0]).toHaveLength(384);
  });

  it('rejects invalid vector dimensions from the ML service', async () => {
    const client = new MlServiceEmbeddingClient('http://ml.test', async () => new Response(
      JSON.stringify({ dimensions: 384, embeddings: [[1, 2, 3]] }),
      { status: 200 },
    ));

    await expect(client.embed(['content'])).rejects.toMatchObject({
      status: 502,
      code: 'EMBEDDING_FAILED',
    });
  });
});

describe('content import parser', () => {
  const content = {
    findTopicBySlugs: async (subjectSlug: string, topicSlug: string) =>
      subjectSlug === 'dsa' && topicSlug === 'arrays'
        ? { id: topicId, subjectId, name: 'Arrays', slug: 'arrays' }
        : null,
  } as unknown as ContentService;

  it('validates and maps JSON question records', async () => {
    const result = await parseImportBody({
      questions: [{
        id: questionId,
        subjectId,
        topicId,
        type: 'mcq',
        statementLatex: 'Which value is largest?',
        optionsJson: ['1', '2'],
        correctAnswerJson: '2',
        solutionLatex: 'Compare the two values.',
      }],
    }, content);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]?.id).toBe(questionId);
    expect(result.questions[0]?.input.difficultyRating).toBe(1000);
    expect(result.questions[0]?.input.isPyq).toBe(false);
  });

  it('resolves CSV slugs and rejects unknown topic references', async () => {
    const result = await parseImportBody({
      questionsCsv: [
        'subjectSlug,topicSlug,type,statementLatex,optionsJson,correctAnswerJson,natTolerance,solutionLatex,isPyq,pyqYear,difficultyRating',
        'dsa,arrays,mcq,"Pick one","[""A"",""B""]","""A""",,A is correct,false,,1000',
      ].join('\n'),
    }, content);

    expect(result.questions[0]?.input.subjectId).toBe(subjectId);
    expect(result.questions[0]?.input.topicId).toBe(topicId);
    await expect(parseImportBody({
      notesCsv: 'subjectSlug,topicSlug,title,content\nmissing,topic,Title,Text',
    }, content)).rejects.toMatchObject({ status: 400, code: 'INVALID_IMPORT' });
  });
});

describe('public question projection', () => {
  it('does not expose the answer key or worked solution', async () => {
    const rows = [{
      id: questionId,
      subject_id: subjectId,
      topic_id: topicId,
      type: 'mcq',
      statement_latex: 'Choose the answer.',
      options_json: ['A', 'B'],
      correct_answer_json: 'A',
      nat_tolerance: null,
      solution_latex: 'A is correct because...',
      is_pyq: false,
      pyq_year: null,
      difficulty_rating: 1000,
      attempt_count: 0,
      created_at: new Date(),
    }];
    const pool = {
      query: async () => ({ rows }),
    } as unknown as ConstructorParameters<typeof PostgresContentRepository>[0];
    const repository = new PostgresContentRepository(pool);

    const question = await repository.getPublicQuestion(questionId);
    expect(question).toMatchObject({ id: questionId, statementLatex: 'Choose the answer.' });
    expect(question).not.toHaveProperty('correctAnswerJson');
    expect(question).not.toHaveProperty('solutionLatex');
  });
});
