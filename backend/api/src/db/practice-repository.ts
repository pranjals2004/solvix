import type { Pool } from 'pg';
import type { PublicQuestion } from '../content/types';
import type {
  PracticeNextResult,
  PracticeSelectionRepository,
  ProgressObservation,
  ProgressRepository,
  ProgressResult,
  ProgressTopic,
} from '../practice/types';
import type { ExperimentArm } from '../domain/user';
import { selectNextQuestion, type QuestionCandidate } from '../practice/selection';

type QuestionRow = {
  id: string;
  subject_id: string;
  topic_id: string;
  type: PublicQuestion['type'];
  statement_latex: string;
  options_json: string[];
  is_pyq: boolean;
  pyq_year: number | null;
  difficulty_rating: number;
};
type CandidateRow = QuestionRow & {
  skill_rating: number | string;
  selected_rating: number | string;
  last_attempt_at: Date | null;
  has_pending_resurface: boolean;
};
type TopicRow = {
  topic_id: string;
  topic_name: string;
  subject_id: string;
  subject_name: string;
  rating: number | string;
  attempts: number | string;
  correct: number | string;
};
type ObservationRow = {
  topic_id: string;
  confidence: number;
  outcome: boolean;
  created_at: Date;
};

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

export class PostgresPracticeRepository implements PracticeSelectionRepository {
  constructor(
    private readonly pool: Pool,
    private readonly epsilon = 200,
    private readonly sigma = 25,
  ) {}

  async next(
    userId: string,
    arm: ExperimentArm,
    topicId?: string,
  ): Promise<PracticeNextResult | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const resurfaced = await client.query<QuestionRow & { skill_rating: number | string }>(
        `WITH due AS (
           SELECT rq.user_id, rq.question_id
           FROM resurface_queue rq
           JOIN questions q ON q.id = rq.question_id
           WHERE rq.user_id = $1 AND rq.due_at <= CURRENT_TIMESTAMP
             AND (rq.last_presented_at IS NULL OR rq.last_presented_at <= CURRENT_TIMESTAMP - INTERVAL '6 hours')
             AND ($2::uuid IS NULL OR q.topic_id = $2)
           ORDER BY rq.due_at, rq.question_id
           FOR UPDATE OF rq SKIP LOCKED
           LIMIT 1
         ), claimed AS (
           UPDATE resurface_queue rq SET last_presented_at = CURRENT_TIMESTAMP
           FROM due WHERE rq.user_id = due.user_id AND rq.question_id = due.question_id
           RETURNING rq.question_id
         )
         SELECT q.id, q.subject_id, q.topic_id, q.type, q.statement_latex, q.options_json,
                q.is_pyq, q.pyq_year, q.difficulty_rating,
                COALESCE(s.rating, 1000) AS skill_rating
         FROM claimed c JOIN questions q ON q.id = c.question_id
         LEFT JOIN user_skill_estimate s ON s.user_id = $1 AND s.topic_id = q.topic_id`,
        [userId, topicId ?? null],
      );
      const dueRow = resurfaced.rows[0];
      if (dueRow) {
        await client.query('COMMIT');
        return {
          question: toPublicQuestion(dueRow),
          isResurfaced: true,
          selectionMode: 'resurfaced',
          skillRating: Number(dueRow.skill_rating),
        };
      }

      const result = await client.query<CandidateRow>(
        `SELECT q.id, q.subject_id, q.topic_id, q.type, q.statement_latex, q.options_json,
                q.is_pyq, q.pyq_year, q.difficulty_rating,
                COALESCE(s.rating, 1000) AS skill_rating,
                COALESCE(qe.rating, q.difficulty_rating)::double precision AS selected_rating,
                latest.created_at AS last_attempt_at,
                (rq.question_id IS NOT NULL) AS has_pending_resurface
         FROM questions q
         LEFT JOIN user_skill_estimate s ON s.user_id = $1 AND s.topic_id = q.topic_id
         LEFT JOIN question_difficulty_estimate qe ON qe.question_id = q.id
         LEFT JOIN resurface_queue rq ON rq.user_id = $1 AND rq.question_id = q.id
         LEFT JOIN LATERAL (
           SELECT created_at FROM submissions WHERE user_id = $1 AND question_id = q.id
           ORDER BY created_at DESC LIMIT 1
         ) latest ON true
         WHERE ($2::uuid IS NULL OR q.topic_id = $2)
         ORDER BY q.id`,
        [userId, topicId ?? null],
      );
      const first = result.rows[0];
      if (!first) {
        await client.query('COMMIT');
        return null;
      }
      const skillRating = Number(first.skill_rating);
      const candidates: QuestionCandidate[] = result.rows.map((row) => ({
        id: row.id,
        difficultyRating: Number(row.selected_rating),
        lastAttemptAt: row.last_attempt_at,
        hasPendingResurface: row.has_pending_resurface,
      }));
      const selected = selectNextQuestion(candidates, {
        arm,
        skillRating,
        epsilon: this.epsilon,
        sigma: this.sigma,
      });
      await client.query('COMMIT');
      if (!selected) return null;
      const selectedRow = result.rows.find((row) => row.id === selected.id);
      if (!selectedRow) return null;
      return {
        question: toPublicQuestion(selectedRow),
        isResurfaced: false,
        selectionMode: arm === 'random' ? 'random' : 'adaptive',
        skillRating: Number(selectedRow.skill_rating),
      };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* preserve original database error */
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

export class PostgresProgressRepository implements ProgressRepository {
  constructor(private readonly pool: Pool) {}

  async getProgress(userId: string): Promise<ProgressResult> {
    const [topicResult, observationResult] = await Promise.all([
      this.pool.query<TopicRow>(
        `SELECT t.id AS topic_id, t.name AS topic_name, s.id AS subject_id, s.name AS subject_name,
                COALESCE(estimate.rating, 1000) AS rating,
                COUNT(sub.id)::text AS attempts,
                COUNT(sub.id) FILTER (WHERE sub.is_correct)::text AS correct
         FROM topics t JOIN subjects s ON s.id = t.subject_id
         LEFT JOIN user_skill_estimate estimate ON estimate.topic_id = t.id AND estimate.user_id = $1
         LEFT JOIN questions q ON q.topic_id = t.id
         LEFT JOIN submissions sub ON sub.question_id = q.id AND sub.user_id = $1
         WHERE estimate.user_id IS NOT NULL OR sub.id IS NOT NULL
         GROUP BY t.id, t.name, s.id, s.name, estimate.rating
         ORDER BY s.name, t.name`,
        [userId],
      ),
      this.pool.query<ObservationRow>(
        `SELECT q.topic_id, re.confidence, (re.outcome = 1) AS outcome, re.created_at
         FROM rating_events re JOIN questions q ON q.id = re.question_id
         WHERE re.user_id = $1 ORDER BY re.created_at DESC LIMIT 2000`,
        [userId],
      ),
    ]);
    return {
      topics: topicResult.rows.map(
        (row): ProgressTopic => ({
          topicId: row.topic_id,
          topicName: row.topic_name,
          subjectId: row.subject_id,
          subjectName: row.subject_name,
          rating: Number(row.rating),
          attempts: Number(row.attempts),
          correct: Number(row.correct),
        }),
      ),
      observations: observationResult.rows.map(
        (row): ProgressObservation => ({
          topicId: row.topic_id,
          confidence: row.confidence,
          outcome: row.outcome,
          createdAt: row.created_at,
        }),
      ),
    };
  }
}
