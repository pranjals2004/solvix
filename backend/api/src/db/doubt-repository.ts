import type { Pool } from 'pg';
import type {
  ConversationMessage, DoubtRecord, DoubtRepository, NewDoubt, RetrievalContext, RetrievalChunk,
} from '../doubts/types';

type DoubtRow = {
  id: string; user_id: string; question_id: string | null; text: string | null; image_key: string | null;
  status: DoubtRecord['status']; conversation_json: ConversationMessage[]; ai_response: string | null;
  retrieval_context_json: RetrievalContext | null; error: string | null; created_at: Date; completed_at: Date | null;
};

const columns = `id, user_id, question_id, text, image_key, status, conversation_json,
  ai_response, retrieval_context_json, error, created_at, completed_at`;

function mapDoubt(row: DoubtRow): DoubtRecord {
  return {
    id: row.id, userId: row.user_id, questionId: row.question_id, text: row.text,
    imageKey: row.image_key, status: row.status, conversation: row.conversation_json ?? [],
    aiResponse: row.ai_response, retrievalContext: row.retrieval_context_json,
    error: row.error, createdAt: row.created_at, completedAt: row.completed_at,
  };
}

function toVector(values: number[]): string {
  if (values.length !== 384 || values.some((value) => !Number.isFinite(value))) {
    throw new Error('A retrieval embedding must have 384 finite dimensions.');
  }
  return `[${values.join(',')}]`;
}

export class PostgresDoubtRepository implements DoubtRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewDoubt): Promise<{ doubt: DoubtRecord; created: boolean }> {
    const result = await this.pool.query<DoubtRow>(
      `INSERT INTO doubt_queries (user_id, question_id, text, image_key, idempotency_key, conversation_json)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING ${columns}`,
      [input.userId, input.questionId, input.text, input.imageKey, input.idempotencyKey, JSON.stringify([input.initialMessage])],
    );
    if (result.rows[0]) return { doubt: mapDoubt(result.rows[0]), created: true };
    const existing = await this.pool.query<DoubtRow>(
      `SELECT ${columns} FROM doubt_queries WHERE user_id = $1 AND idempotency_key = $2`,
      [input.userId, input.idempotencyKey],
    );
    if (!existing.rows[0]) throw new Error('Idempotent doubt insert returned no row.');
    return { doubt: mapDoubt(existing.rows[0]), created: false };
  }

  async getForUser(userId: string, doubtId: string): Promise<DoubtRecord | null> {
    const result = await this.pool.query<DoubtRow>(
      `SELECT ${columns} FROM doubt_queries WHERE id = $1 AND user_id = $2`, [doubtId, userId],
    );
    return result.rows[0] ? mapDoubt(result.rows[0]) : null;
  }

  async getById(doubtId: string): Promise<DoubtRecord | null> {
    const result = await this.pool.query<DoubtRow>(`SELECT ${columns} FROM doubt_queries WHERE id = $1`, [doubtId]);
    return result.rows[0] ? mapDoubt(result.rows[0]) : null;
  }

  async appendUserMessage(userId: string, doubtId: string, message: ConversationMessage): Promise<DoubtRecord | null> {
    const result = await this.pool.query<DoubtRow>(
      `UPDATE doubt_queries SET
         conversation_json = CASE WHEN conversation_json @> $3::jsonb
           THEN conversation_json ELSE conversation_json || $3::jsonb END,
         status = CASE WHEN conversation_json @> $3::jsonb THEN status ELSE 'pending'::doubt_status END,
         error = NULL, completed_at = NULL
       WHERE id = $1 AND user_id = $2
       RETURNING ${columns}`,
      [doubtId, userId, JSON.stringify([message])],
    );
    return result.rows[0] ? mapDoubt(result.rows[0]) : null;
  }

  async setProcessing(doubtId: string): Promise<void> {
    await this.pool.query(
      `UPDATE doubt_queries SET status = 'processing', error = NULL WHERE id = $1`, [doubtId],
    );
  }

  async getRetrievalContext(doubtId: string, embedding: number[]): Promise<RetrievalContext | null> {
    const vector = toVector(embedding);
    const doubtResult = await this.pool.query<{
      question_id: string | null; statement_latex: string | null; solution_latex: string | null; topic_id: string | null;
    }>(
      `SELECT d.question_id, q.statement_latex, q.solution_latex, q.topic_id
       FROM doubt_queries d LEFT JOIN questions q ON q.id = d.question_id WHERE d.id = $1`, [doubtId],
    );
    const doubt = doubtResult.rows[0];
    if (!doubt) return null;
    const chunks = await this.pool.query<RetrievalChunk & { source_type: 'note' | 'solution'; source_id: string; topic_id: string }>(
      `SELECT id, title, content, source_type, source_id, topic_id,
         1 - (embedding <=> $1::vector) AS similarity
       FROM note_chunks
       WHERE embedding IS NOT NULL
       ORDER BY
         CASE WHEN source_type = 'solution' AND source_id = $2 THEN 0
              WHEN topic_id = $3 THEN 1 ELSE 2 END,
         embedding <=> $1::vector
       LIMIT 3`,
      [vector, doubt.question_id, doubt.topic_id],
    );
    return {
      questionId: doubt.question_id,
      questionStatement: doubt.statement_latex,
      questionSolution: doubt.solution_latex,
      topicId: doubt.topic_id,
      chunks: chunks.rows.map((row) => ({
        id: row.id, title: row.title, content: row.content,
        sourceType: row.source_type, sourceId: row.source_id, topicId: row.topic_id,
        similarity: Number(row.similarity),
      })),
    };
  }

  async complete(doubtId: string, answer: string, context: RetrievalContext): Promise<DoubtRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query<{ conversation_json: ConversationMessage[] }>(
        'SELECT conversation_json FROM doubt_queries WHERE id = $1 FOR UPDATE', [doubtId],
      );
      const row = current.rows[0];
      if (!row) throw new Error('Doubt no longer exists.');
      const assistantMessage: ConversationMessage = {
        id: `assistant-${Date.now()}`, role: 'assistant', text: answer, createdAt: new Date().toISOString(),
      };
      const result = await client.query<DoubtRow>(
        `UPDATE doubt_queries SET conversation_json = $2::jsonb, ai_response = $3,
           retrieval_context_json = $4::jsonb, status = 'done', error = NULL,
           completed_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING ${columns}`,
        [doubtId, JSON.stringify([...(row.conversation_json ?? []), assistantMessage]), answer, JSON.stringify(context)],
      );
      await client.query('COMMIT');
      if (!result.rows[0]) throw new Error('Doubt completion returned no record.');
      return mapDoubt(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async fail(doubtId: string, message: string): Promise<void> {
    await this.pool.query(
      `UPDATE doubt_queries SET status = 'failed', error = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [doubtId, message],
    );
  }

  async saveFeedback(userId: string, doubtId: string, helpful: boolean): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO doubt_feedback (doubt_id, user_id, helpful)
       SELECT d.id, d.user_id, $3 FROM doubt_queries d WHERE d.id = $1 AND d.user_id = $2
       ON CONFLICT (doubt_id, user_id) DO UPDATE SET helpful = EXCLUDED.helpful, created_at = CURRENT_TIMESTAMP`,
      [doubtId, userId, helpful],
    );
    return result.rowCount === 1;
  }
}
