import type { Pool, PoolClient } from 'pg';
import { anonymizeDoubt } from '../misconceptions/anonymize';
import type {
  AdminMisconceptionCluster,
  DoubtClusterInput,
  MisconceptionExportRow,
  MisconceptionHint,
  MisconceptionRepository,
  MisconceptionTopic,
  MisconceptionTopicRunStatus,
  ClusterGroup,
} from '../misconceptions/types';

type TopicRow = {
  id: string;
  name: string;
  slug: string;
  subject_id: string;
  subject_name: string;
  subject_slug: string;
};
type DoubtRow = { id: string; text: string | null; name: string | null; email: string };
type ClusterRow = {
  id: string;
  run_id: string;
  cluster_code: string;
  label: string | null;
  size: number;
  subject_id: string;
  subject_name: string;
  topic_id: string;
  topic_name: string;
  exemplar_doubt_ids: string[];
  created_at: Date;
};
type ExemplarRow = { id: string; text: string | null; name: string | null; email: string };
type RunStatusRow = {
  topic_id: string;
  topic_name: string;
  status: MisconceptionTopicRunStatus['status'];
  doubts_processed: number;
  clusters_found: number;
  error: string | null;
  started_at: Date;
  completed_at: Date | null;
};

function toTopic(row: TopicRow): MisconceptionTopic {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    subjectSlug: row.subject_slug,
  };
}

function clusterColumns(alias = 'mc') {
  return `${alias}.id, ${alias}.run_id, ${alias}.cluster_code, ${alias}.label, ${alias}.size,
    ${alias}.subject_id, s.name AS subject_name, ${alias}.topic_id, t.name AS topic_name,
    ${alias}.exemplar_doubt_ids, ${alias}.created_at`;
}

export class PostgresMisconceptionRepository implements MisconceptionRepository {
  constructor(private readonly pool: Pool) {}

  async createQueuedRun(runId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO misconception_cluster_runs (run_id, topic_id, subject_id, status)
       SELECT $1, topic.id, topic.subject_id, 'queued' FROM topics topic
       ON CONFLICT (run_id, topic_id) DO NOTHING`,
      [runId],
    );
  }

  async failQueuedRun(runId: string, message: string): Promise<void> {
    await this.pool.query(
      `UPDATE misconception_cluster_runs
       SET status = 'failed', error = $2, completed_at = CURRENT_TIMESTAMP
       WHERE run_id = $1 AND status = 'queued'`,
      [runId, message.slice(0, 500)],
    );
  }

  async listTopics(): Promise<MisconceptionTopic[]> {
    const result = await this.pool.query<TopicRow>(
      `SELECT t.id, t.name, t.slug, s.id AS subject_id, s.name AS subject_name, s.slug AS subject_slug
       FROM topics t JOIN subjects s ON s.id = t.subject_id ORDER BY s.name, t.name`,
    );
    return result.rows.map(toTopic);
  }

  async listDoubts(topicId: string, limit: number): Promise<DoubtClusterInput[]> {
    const result = await this.pool.query<DoubtRow>(
      `SELECT d.id,
              COALESCE(d.text, d.conversation_json->0->>'text', q.statement_latex) AS text,
              u.name, u.email
       FROM doubt_queries d
       JOIN users u ON u.id = d.user_id
       LEFT JOIN questions q ON q.id = d.question_id
       WHERE d.status = 'done'
         AND COALESCE(q.topic_id, NULLIF(d.retrieval_context_json->>'topicId', '')::uuid) = $1
       ORDER BY d.created_at DESC, d.id
       LIMIT $2`,
      [topicId, limit],
    );
    return result.rows.flatMap((row) => (row.text ? [{ ...row, text: row.text }] : []));
  }

  async startTopicRun(runId: string, topic: MisconceptionTopic): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO misconception_cluster_runs
          (run_id, topic_id, subject_id, status, doubts_processed, clusters_found, started_at, completed_at, error)
         VALUES ($1, $2, $3, 'running', 0, 0, CURRENT_TIMESTAMP, NULL, NULL)
         ON CONFLICT (run_id, topic_id) DO UPDATE
         SET status = 'running', doubts_processed = 0, clusters_found = 0,
             started_at = CURRENT_TIMESTAMP, completed_at = NULL, error = NULL`,
        [runId, topic.id, topic.subjectId],
      );
      await client.query(`DELETE FROM misconception_clusters WHERE run_id = $1 AND topic_id = $2`, [
        runId,
        topic.id,
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async completeTopicRun(
    runId: string,
    topic: MisconceptionTopic,
    doubtsProcessed: number,
    clusters: Array<ClusterGroup & { doubtIds: string[] }>,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const priorClusters = await client.query<{ count: number | string }>(
        `SELECT COUNT(*)::integer AS count FROM misconception_clusters
         WHERE run_id = $1 AND subject_id = $2`,
        [runId, topic.subjectId],
      );
      let clusterSequence = Number(priorClusters.rows[0]?.count ?? 0);
      for (const cluster of clusters) {
        clusterSequence += 1;
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO misconception_clusters
             (subject_id, topic_id, cluster_code, label, size, exemplar_doubt_ids, run_id)
           VALUES ($1, $2, $3, NULL, $4, $5::uuid[], $6)
           RETURNING id`,
          [
            topic.subjectId,
            topic.id,
            clusterCode(topic.subjectSlug, clusterSequence),
            cluster.size,
            cluster.exemplarDoubtIds,
            runId,
          ],
        );
        const clusterId = inserted.rows[0]?.id;
        if (!clusterId) throw new Error('Cluster insert did not return an id.');
        await client.query(
          `INSERT INTO user_misconception_tags (user_id, cluster_id, doubt_id)
           SELECT d.user_id, $1, d.id FROM doubt_queries d WHERE d.id = ANY($2::uuid[])
           ON CONFLICT (user_id, cluster_id, doubt_id) DO NOTHING`,
          [clusterId, cluster.doubtIds],
        );
      }
      await client.query(
        `UPDATE misconception_cluster_runs
         SET status = 'completed', doubts_processed = $3, clusters_found = $4,
             completed_at = CURRENT_TIMESTAMP, error = NULL
         WHERE run_id = $1 AND topic_id = $2`,
        [runId, topic.id, doubtsProcessed, clusters.length],
      );
      await client.query('COMMIT');
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async failTopicRun(runId: string, topic: MisconceptionTopic, message: string): Promise<void> {
    await this.pool.query(
      `UPDATE misconception_cluster_runs
       SET status = 'failed', error = $3, completed_at = CURRENT_TIMESTAMP
       WHERE run_id = $1 AND topic_id = $2`,
      [runId, topic.id, message],
    );
  }

  async getRunStatus(runId: string): Promise<MisconceptionTopicRunStatus[]> {
    const result = await this.pool.query<RunStatusRow>(
      `SELECT r.topic_id, t.name AS topic_name, r.status, r.doubts_processed,
              r.clusters_found, r.error, r.started_at, r.completed_at
       FROM misconception_cluster_runs r JOIN topics t ON t.id = r.topic_id
       WHERE r.run_id = $1 ORDER BY t.name`,
      [runId],
    );
    return result.rows.map((row) => ({
      topicId: row.topic_id,
      topicName: row.topic_name,
      status: row.status,
      doubtsProcessed: row.doubts_processed,
      clustersFound: row.clusters_found,
      error: row.error,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }));
  }

  async listAdminClusters(topicId?: string): Promise<AdminMisconceptionCluster[]> {
    const result = await this.pool.query<ClusterRow>(
      `SELECT ${clusterColumns()}
       FROM misconception_clusters mc
       JOIN topics t ON t.id = mc.topic_id
       JOIN subjects s ON s.id = mc.subject_id
       JOIN LATERAL (
         SELECT r.run_id FROM misconception_cluster_runs r
         WHERE r.topic_id = mc.topic_id AND r.status = 'completed'
         ORDER BY r.completed_at DESC, r.started_at DESC, r.run_id DESC LIMIT 1
       ) latest ON latest.run_id = mc.run_id
       WHERE ($1::uuid IS NULL OR mc.topic_id = $1)
       ORDER BY s.name, t.name, mc.cluster_code`,
      [topicId ?? null],
    );
    return Promise.all(result.rows.map((row) => this.withExemplars(row)));
  }

  async labelCluster(clusterId: string, label: string): Promise<AdminMisconceptionCluster | null> {
    const updated = await this.pool.query<{ topic_id: string }>(
      `UPDATE misconception_clusters mc SET label = $2
       WHERE mc.id = $1 AND mc.run_id = (
         SELECT r.run_id FROM misconception_cluster_runs r
         WHERE r.topic_id = mc.topic_id AND r.status = 'completed'
         ORDER BY r.completed_at DESC, r.started_at DESC, r.run_id DESC LIMIT 1
       )
       RETURNING mc.topic_id`,
      [clusterId, label],
    );
    const topicId = updated.rows[0]?.topic_id;
    if (!topicId) return null;
    const clusters = await this.listAdminClusters(topicId);
    return clusters.find((cluster) => cluster.id === clusterId) ?? null;
  }

  async listStudentHints(userId: string): Promise<MisconceptionHint[]> {
    const result = await this.pool.query<MisconceptionHint>(
      `SELECT DISTINCT ON (mc.id)
         mc.id AS "clusterId", mc.label, mc.topic_id AS "topicId", t.name AS "topicName"
       FROM user_misconception_tags tag
       JOIN misconception_clusters mc ON mc.id = tag.cluster_id
       JOIN topics t ON t.id = mc.topic_id
       JOIN misconception_cluster_runs r ON r.run_id = mc.run_id AND r.topic_id = mc.topic_id
       WHERE tag.user_id = $1 AND mc.label IS NOT NULL AND r.status = 'completed'
         AND r.run_id = (
           SELECT latest.run_id FROM misconception_cluster_runs latest
           WHERE latest.topic_id = mc.topic_id AND latest.status = 'completed'
           ORDER BY latest.completed_at DESC, latest.started_at DESC, latest.run_id DESC LIMIT 1
         )
       ORDER BY mc.id, t.name
       LIMIT 20`,
      [userId],
    );
    return result.rows;
  }

  async listLabeledExportRows(): Promise<MisconceptionExportRow[]> {
    const result = await this.pool.query<{
      subject_name: string;
      topic_name: string;
      cluster_code: string;
      label: string;
      cluster_size: number;
      total_doubts: number;
      share_of_doubt_volume: number | string;
      created_at: Date;
    }>(
      `SELECT s.name AS subject_name, t.name AS topic_name, mc.cluster_code, mc.label,
              mc.size AS cluster_size, run.doubts_processed AS total_doubts,
              mc.size::double precision / NULLIF(run.doubts_processed, 0) AS share_of_doubt_volume,
              mc.created_at
       FROM misconception_clusters mc
       JOIN misconception_cluster_runs run ON run.run_id = mc.run_id AND run.topic_id = mc.topic_id
       JOIN topics t ON t.id = mc.topic_id
       JOIN subjects s ON s.id = mc.subject_id
       JOIN LATERAL (
         SELECT latest.run_id FROM misconception_cluster_runs latest
         WHERE latest.topic_id = mc.topic_id AND latest.status = 'completed'
         ORDER BY latest.completed_at DESC, latest.started_at DESC, latest.run_id DESC LIMIT 1
       ) current_run ON current_run.run_id = mc.run_id
       WHERE run.status = 'completed' AND mc.label IS NOT NULL
       ORDER BY s.name, t.name, mc.cluster_code`,
    );
    return result.rows.map((row) => ({
      subjectName: row.subject_name,
      topicName: row.topic_name,
      clusterCode: row.cluster_code,
      label: row.label,
      clusterSize: row.cluster_size,
      totalDoubts: row.total_doubts,
      shareOfDoubtVolume: Number(row.share_of_doubt_volume ?? 0),
      createdAt: row.created_at,
    }));
  }

  private async withExemplars(row: ClusterRow): Promise<AdminMisconceptionCluster> {
    if (row.exemplar_doubt_ids.length === 0) {
      return { ...toAdminCluster(row), exemplars: [] };
    }
    const result = await this.pool.query<ExemplarRow>(
      `SELECT d.id, COALESCE(d.text, d.conversation_json->0->>'text', q.statement_latex) AS text,
              u.name, u.email
       FROM doubt_queries d JOIN users u ON u.id = d.user_id
       LEFT JOIN questions q ON q.id = d.question_id
       WHERE d.id = ANY($1::uuid[])`,
      [row.exemplar_doubt_ids],
    );
    const examples = new Map(result.rows.map((example) => [example.id, example]));
    return {
      ...toAdminCluster(row),
      exemplars: row.exemplar_doubt_ids.flatMap((id) => {
        const example = examples.get(id);
        if (!example?.text) return [];
        const text = anonymizeDoubt({
          id,
          text: example.text,
          name: example.name,
          email: example.email,
        });
        return text ? [{ doubtId: id, text }] : [];
      }),
    };
  }
}

function toAdminCluster(row: ClusterRow): Omit<AdminMisconceptionCluster, 'exemplars'> {
  return {
    id: row.id,
    runId: row.run_id,
    clusterCode: row.cluster_code,
    label: row.label,
    size: row.size,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    topicId: row.topic_id,
    topicName: row.topic_name,
    createdAt: row.created_at,
  };
}

function clusterCode(subjectSlug: string, sequence: number): string {
  const words = subjectSlug
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const prefix = (
    words.length > 1 ? words.map((word) => word[0]).join('') : (words[0] ?? 'SUB')
  ).slice(0, 3);
  return `${prefix}-C${String(sequence).padStart(2, '0')}`;
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original database error.
  }
}
