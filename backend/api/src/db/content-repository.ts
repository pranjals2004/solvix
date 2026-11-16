import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type {
  AdminQuestion,
  ContentRepository,
  EmbeddedChunk,
  NoteInput,
  NoteRecord,
  PreparedNote,
  PreparedQuestion,
  PublicQuestion,
  QuestionFilters,
  QuestionInput,
  SubjectRecord,
  TopicRecord,
} from '../content/types';

type SubjectRow = { id: string; name: string; slug: string };
type TopicRow = { id: string; subject_id: string; name: string; slug: string };
type QuestionRow = {
  id: string;
  subject_id: string;
  topic_id: string;
  type: AdminQuestion['type'];
  statement_latex: string;
  options_json: string[];
  correct_answer_json: AdminQuestion['correctAnswerJson'];
  nat_tolerance: number | string | null;
  solution_latex: string;
  is_pyq: boolean;
  pyq_year: number | null;
  difficulty_rating: number;
  attempt_count: number;
  created_at: Date;
};
type NoteRow = {
  id: string;
  subject_id: string;
  topic_id: string;
  title: string;
  content: string;
  updated_at: Date;
};

const questionColumns = `id, subject_id, topic_id, type, statement_latex, options_json,
  correct_answer_json, nat_tolerance, solution_latex, is_pyq, pyq_year,
  difficulty_rating, attempt_count, created_at`;

function toSubject(row: SubjectRow): SubjectRecord {
  return { id: row.id, name: row.name, slug: row.slug };
}

function toTopic(row: TopicRow): TopicRecord {
  return { id: row.id, subjectId: row.subject_id, name: row.name, slug: row.slug };
}

function toAdminQuestion(row: QuestionRow): AdminQuestion {
  return {
    id: row.id,
    subjectId: row.subject_id,
    topicId: row.topic_id,
    type: row.type,
    statementLatex: row.statement_latex,
    optionsJson: row.options_json,
    correctAnswerJson: row.correct_answer_json,
    natTolerance: row.nat_tolerance === null ? null : Number(row.nat_tolerance),
    solutionLatex: row.solution_latex,
    isPyq: row.is_pyq,
    pyqYear: row.pyq_year,
    difficultyRating: row.difficulty_rating,
    attemptCount: row.attempt_count,
    createdAt: row.created_at,
  };
}

function toPublicQuestion(row: QuestionRow): PublicQuestion {
  return {
    id: row.id,
    subjectId: row.subject_id,
    topicId: row.topic_id,
    type: row.type,
    statementLatex: row.statement_latex,
    optionsJson: row.options_json,
    isPyq: row.is_pyq,
    pyqYear: row.pyq_year,
    difficultyRating: row.difficulty_rating,
  };
}

function vectorValue(values: number[]): string {
  if (values.length !== 384 || values.some((value) => !Number.isFinite(value))) {
    throw new Error('Each content embedding must contain 384 finite numbers.');
  }
  return `[${values.join(',')}]`;
}

export class PostgresContentRepository implements ContentRepository {
  constructor(private readonly pool: Pool) {}

  async listSubjects(): Promise<SubjectRecord[]> {
    const result = await this.pool.query<SubjectRow>('SELECT id, name, slug FROM subjects ORDER BY name');
    return result.rows.map(toSubject);
  }

  async listTopics(subjectId: string): Promise<TopicRecord[]> {
    const result = await this.pool.query<TopicRow>(
      'SELECT id, subject_id, name, slug FROM topics WHERE subject_id = $1 ORDER BY name',
      [subjectId],
    );
    return result.rows.map(toTopic);
  }

  async listQuestions(filters: QuestionFilters): Promise<PublicQuestion[]> {
    const clauses: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      clauses.push(sql.replace('?', `$${values.length}`));
    };
    if (filters.subjectId) add('subject_id = ?', filters.subjectId);
    if (filters.topicId) add('topic_id = ?', filters.topicId);
    if (filters.pyq !== undefined) add('is_pyq = ?', filters.pyq);
    if (filters.year !== undefined) add('pyq_year = ?', filters.year);

    values.push(filters.limit);
    const limitParam = `$${values.length}`;
    values.push(filters.offset);
    const offsetParam = `$${values.length}`;
    const result = await this.pool.query<QuestionRow>(
      `SELECT ${questionColumns} FROM questions
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY created_at DESC, id LIMIT ${limitParam} OFFSET ${offsetParam}`,
      values,
    );
    return result.rows.map(toPublicQuestion);
  }

  async listAdminQuestions(filters: QuestionFilters): Promise<AdminQuestion[]> {
    const clauses: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      clauses.push(sql.replace('?', `$${values.length}`));
    };
    if (filters.subjectId) add('subject_id = ?', filters.subjectId);
    if (filters.topicId) add('topic_id = ?', filters.topicId);
    if (filters.pyq !== undefined) add('is_pyq = ?', filters.pyq);
    if (filters.year !== undefined) add('pyq_year = ?', filters.year);

    values.push(filters.limit);
    const limitParam = `$${values.length}`;
    values.push(filters.offset);
    const offsetParam = `$${values.length}`;
    const result = await this.pool.query<QuestionRow>(
      `SELECT ${questionColumns} FROM questions
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY created_at DESC, id LIMIT ${limitParam} OFFSET ${offsetParam}`,
      values,
    );
    return result.rows.map(toAdminQuestion);
  }

  async getPublicQuestion(id: string): Promise<PublicQuestion | null> {
    const result = await this.pool.query<QuestionRow>(
      `SELECT ${questionColumns} FROM questions WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toPublicQuestion(result.rows[0]) : null;
  }

  async getAdminQuestion(id: string): Promise<AdminQuestion | null> {
    const result = await this.pool.query<QuestionRow>(
      `SELECT ${questionColumns} FROM questions WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toAdminQuestion(result.rows[0]) : null;
  }

  async listNotes(topicId: string): Promise<NoteRecord[]> {
    const result = await this.pool.query<NoteRow>(
      `SELECT id, subject_id, topic_id, title, content, updated_at
       FROM notes WHERE topic_id = $1 ORDER BY title`,
      [topicId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      subjectId: row.subject_id,
      topicId: row.topic_id,
      title: row.title,
      content: row.content,
      updatedAt: row.updated_at,
    }));
  }

  async findTopicBySlugs(subjectSlug: string, topicSlug: string): Promise<TopicRecord | null> {
    const result = await this.pool.query<TopicRow>(
      `SELECT t.id, t.subject_id, t.name, t.slug
       FROM topics t JOIN subjects s ON s.id = t.subject_id
       WHERE s.slug = $1 AND t.slug = $2`,
      [subjectSlug, topicSlug],
    );
    return result.rows[0] ? toTopic(result.rows[0]) : null;
  }

  async createSubject(input: { name: string; slug: string }): Promise<SubjectRecord> {
    const result = await this.pool.query<SubjectRow>(
      'INSERT INTO subjects (name, slug) VALUES ($1, $2) RETURNING id, name, slug',
      [input.name, input.slug],
    );
    return toSubject(requireRow(result.rows[0]));
  }

  async updateSubject(id: string, input: { name?: string; slug?: string }): Promise<SubjectRecord | null> {
    const result = await this.pool.query<SubjectRow>(
      `UPDATE subjects SET name = COALESCE($2, name), slug = COALESCE($3, slug)
       WHERE id = $1 RETURNING id, name, slug`,
      [id, input.name ?? null, input.slug ?? null],
    );
    return result.rows[0] ? toSubject(result.rows[0]) : null;
  }

  async deleteSubject(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM subjects WHERE id = $1', [id]);
    return result.rowCount === 1;
  }

  async createTopic(input: { subjectId: string; name: string; slug: string }): Promise<TopicRecord> {
    const result = await this.pool.query<TopicRow>(
      `INSERT INTO topics (subject_id, name, slug) VALUES ($1, $2, $3)
       RETURNING id, subject_id, name, slug`,
      [input.subjectId, input.name, input.slug],
    );
    return toTopic(requireRow(result.rows[0]));
  }

  async updateTopic(id: string, input: { name?: string; slug?: string }): Promise<TopicRecord | null> {
    const result = await this.pool.query<TopicRow>(
      `UPDATE topics SET name = COALESCE($2, name), slug = COALESCE($3, slug)
       WHERE id = $1 RETURNING id, subject_id, name, slug`,
      [id, input.name ?? null, input.slug ?? null],
    );
    return result.rows[0] ? toTopic(result.rows[0]) : null;
  }

  async deleteTopic(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM topics WHERE id = $1', [id]);
    return result.rowCount === 1;
  }

  async saveQuestion(
    id: string | undefined,
    input: QuestionInput,
    chunks: EmbeddedChunk[],
  ): Promise<AdminQuestion | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let question: QuestionRow;
      if (id) {
        const result = await updateQuestion(client, id, input);
        const row = result.rows[0];
        if (!row) {
          await client.query('ROLLBACK');
          return null;
        }
        question = row;
      } else {
        const result = await insertQuestion(client, input);
        question = requireRow(result.rows[0]);
      }
      await replaceChunks(
        client, 'solution', question.id, input.subjectId, input.topicId,
        `Solution: ${input.statementLatex.slice(0, 120)}`, chunks,
      );
      await client.query('COMMIT');
      return toAdminQuestion(question);
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteQuestion(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("DELETE FROM note_chunks WHERE source_type = 'solution' AND source_id = $1", [id]);
      const result = await client.query('DELETE FROM questions WHERE id = $1', [id]);
      await client.query('COMMIT');
      return result.rowCount === 1;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveNote(
    id: string | undefined,
    input: NoteInput,
    chunks: EmbeddedChunk[],
  ): Promise<NoteRecord | null> {
    const sourceId = id ?? randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let note: NoteRow;
      if (id) {
        const result = await client.query<NoteRow>(
          `UPDATE notes SET subject_id = $2, topic_id = $3, title = $4, content = $5,
             updated_at = CURRENT_TIMESTAMP WHERE id = $1
           RETURNING id, subject_id, topic_id, title, content, updated_at`,
          [id, input.subjectId, input.topicId, input.title, input.content],
        );
        const row = result.rows[0];
        if (!row) {
          await client.query('ROLLBACK');
          return null;
        }
        note = row;
      } else {
        const result = await client.query<NoteRow>(
          `INSERT INTO notes (id, subject_id, topic_id, title, content)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, subject_id, topic_id, title, content, updated_at`,
          [sourceId, input.subjectId, input.topicId, input.title, input.content],
        );
        note = requireRow(result.rows[0]);
      }
      await replaceChunks(client, 'note', sourceId, input.subjectId, input.topicId, input.title, chunks);
      await client.query('COMMIT');
      return {
        id: note.id,
        subjectId: note.subject_id,
        topicId: note.topic_id,
        title: note.title,
        content: note.content,
        updatedAt: note.updated_at,
      };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteNote(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("DELETE FROM note_chunks WHERE source_id = $1 AND source_type = 'note'", [id]);
      const result = await client.query('DELETE FROM notes WHERE id = $1', [id]);
      await client.query('COMMIT');
      return result.rowCount === 1;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async importContent(
    questions: PreparedQuestion[],
    notes: PreparedNote[],
  ): Promise<{ questions: number; notes: number }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of questions) {
        const result = item.id
          ? await upsertQuestion(client, item.id, item.input)
          : await insertQuestion(client, item.input);
        const question = requireRow(result.rows[0]);
        await replaceChunks(
          client, 'solution', question.id, item.input.subjectId, item.input.topicId,
          `Solution: ${item.input.statementLatex.slice(0, 120)}`, item.solutionChunks,
        );
      }
      for (const item of notes) {
        const id = item.id ?? randomUUID();
        await client.query(
          `INSERT INTO notes (id, subject_id, topic_id, title, content)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET subject_id = EXCLUDED.subject_id,
             topic_id = EXCLUDED.topic_id, title = EXCLUDED.title, content = EXCLUDED.content,
             updated_at = CURRENT_TIMESTAMP`,
          [id, item.input.subjectId, item.input.topicId, item.input.title, item.input.content],
        );
        await replaceChunks(client, 'note', id, item.input.subjectId, item.input.topicId, item.input.title, item.chunks);
      }
      await client.query('COMMIT');
      return { questions: questions.length, notes: notes.length };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

async function insertQuestion(client: PoolClient, input: QuestionInput) {
  return client.query<QuestionRow>(
    `INSERT INTO questions
      (subject_id, topic_id, type, statement_latex, options_json, correct_answer_json,
       nat_tolerance, solution_latex, is_pyq, pyq_year, difficulty_rating)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11)
     RETURNING ${questionColumns}`,
    questionValues(input),
  );
}

async function updateQuestion(client: PoolClient, id: string, input: QuestionInput) {
  return client.query<QuestionRow>(
    `UPDATE questions SET subject_id = $2, topic_id = $3, type = $4,
       statement_latex = $5, options_json = $6::jsonb, correct_answer_json = $7::jsonb,
       nat_tolerance = $8, solution_latex = $9, is_pyq = $10, pyq_year = $11,
       difficulty_rating = $12
     WHERE id = $1 RETURNING ${questionColumns}`,
    [id, ...questionValues(input)],
  );
}

async function upsertQuestion(client: PoolClient, id: string, input: QuestionInput) {
  return client.query<QuestionRow>(
    `INSERT INTO questions
      (id, subject_id, topic_id, type, statement_latex, options_json, correct_answer_json,
       nat_tolerance, solution_latex, is_pyq, pyq_year, difficulty_rating)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET subject_id = EXCLUDED.subject_id,
       topic_id = EXCLUDED.topic_id, type = EXCLUDED.type, statement_latex = EXCLUDED.statement_latex,
       options_json = EXCLUDED.options_json, correct_answer_json = EXCLUDED.correct_answer_json,
       nat_tolerance = EXCLUDED.nat_tolerance, solution_latex = EXCLUDED.solution_latex,
       is_pyq = EXCLUDED.is_pyq, pyq_year = EXCLUDED.pyq_year,
       difficulty_rating = EXCLUDED.difficulty_rating
     RETURNING ${questionColumns}`,
    [id, ...questionValues(input)],
  );
}

function questionValues(input: QuestionInput): unknown[] {
  return [
    input.subjectId,
    input.topicId,
    input.type,
    input.statementLatex,
    JSON.stringify(input.optionsJson),
    JSON.stringify(input.correctAnswerJson),
    input.natTolerance,
    input.solutionLatex,
    input.isPyq,
    input.pyqYear,
    input.difficultyRating,
  ];
}

async function replaceChunks(
  client: PoolClient,
  sourceType: 'note' | 'solution',
  sourceId: string,
  subjectId: string,
  topicId: string,
  title: string,
  chunks: EmbeddedChunk[],
): Promise<void> {
  await client.query(
    'DELETE FROM note_chunks WHERE source_type = $1 AND source_id = $2',
    [sourceType, sourceId],
  );
  for (const chunk of chunks) {
    await client.query(
      `INSERT INTO note_chunks
        (subject_id, topic_id, source_type, source_id, title, chunk_index, content, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)`,
      [subjectId, topicId, sourceType, sourceId, title, chunk.chunkIndex, chunk.content, vectorValue(chunk.embedding)],
    );
  }
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Keep the original database error; the connection is released by the caller.
  }
}

function requireRow<Row>(row: Row | undefined): Row {
  if (!row) throw new Error('Database write returned no record.');
  return row;
}
