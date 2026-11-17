import type { Pool } from 'pg';
import type { CreatePeerThread, PeerDoubtRepository, PeerReply, PeerThread } from '../community/types';

type ThreadRow = {
  id: string; author_name: string; is_anonymous: boolean; title: string; body: string;
  subject_id: string | null; subject_name: string | null; topic_id: string | null; topic_name: string | null;
  question_id: string | null; created_at: Date; reply_count: number | string;
};
type ReplyRow = { id: string; author_name: string; body: string; created_at: Date };
function threadQuery(filter: string): string {
  return `SELECT t.id, CASE WHEN t.is_anonymous THEN 'Anonymous student' ELSE u.name END AS author_name,
    t.is_anonymous, t.title, t.body, t.subject_id, s.name AS subject_name, t.topic_id, p.name AS topic_name,
    t.question_id, t.created_at,
    (SELECT COUNT(*)::integer FROM peer_doubt_replies r WHERE r.thread_id = t.id) AS reply_count
    FROM peer_doubt_threads t JOIN users u ON u.id = t.user_id
    LEFT JOIN subjects s ON s.id = t.subject_id LEFT JOIN topics p ON p.id = t.topic_id
    ${filter}`;
}

function mapThread(row: ThreadRow, replies: PeerReply[] = []): PeerThread {
  return {
    id: row.id, authorName: row.author_name, isAnonymous: row.is_anonymous,
    title: row.title, body: row.body, subjectId: row.subject_id, subjectName: row.subject_name,
    topicId: row.topic_id, topicName: row.topic_name, questionId: row.question_id,
    createdAt: row.created_at, replyCount: Number(row.reply_count), replies,
  };
}

export class PostgresPeerDoubtRepository implements PeerDoubtRepository {
  constructor(private readonly pool: Pool) {}

  async list(input: { subjectId: string | null; topicId: string | null; limit: number }): Promise<PeerThread[]> {
    const result = await this.pool.query<ThreadRow>(
      threadQuery('WHERE ($1::uuid IS NULL OR t.subject_id = $1) AND ($2::uuid IS NULL OR t.topic_id = $2) ORDER BY t.created_at DESC, t.id LIMIT $3'),
      [input.subjectId, input.topicId, input.limit],
    );
    return result.rows.map((row) => mapThread(row));
  }

  async get(threadId: string): Promise<PeerThread | null> {
    const result = await this.pool.query<ThreadRow>(threadQuery('WHERE t.id = $1'), [threadId]);
    const row = result.rows[0];
    if (!row) return null;
    const replies = await this.listReplies(threadId);
    return mapThread(row, replies);
  }

  async create(userId: string, input: CreatePeerThread): Promise<PeerThread> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO peer_doubt_threads (user_id, question_id, subject_id, topic_id, title, body, is_anonymous)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [userId, input.questionId, input.subjectId, input.topicId, input.title, input.body, input.anonymous],
    );
    const created = result.rows[0];
    if (!created) throw new Error('Created peer thread was not returned.');
    const thread = await this.get(created.id);
    if (!thread) throw new Error('Created peer thread could not be loaded.');
    return thread;
  }

  async reply(threadId: string, userId: string, body: string): Promise<PeerThread | null> {
    const inserted = await this.pool.query(
      `INSERT INTO peer_doubt_replies (thread_id, user_id, body)
       SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM peer_doubt_threads WHERE id = $1)`,
      [threadId, userId, body],
    );
    if (inserted.rowCount !== 1) return null;
    return this.get(threadId);
  }

  private async listReplies(threadId: string): Promise<PeerReply[]> {
    const result = await this.pool.query<ReplyRow>(
      `SELECT r.id, u.name AS author_name, r.body, r.created_at
       FROM peer_doubt_replies r JOIN users u ON u.id = r.user_id
       WHERE r.thread_id = $1 ORDER BY r.created_at, r.id`,
      [threadId],
    );
    return result.rows.map((row) => ({
      id: row.id, authorName: row.author_name, body: row.body, createdAt: row.created_at,
    }));
  }
}
