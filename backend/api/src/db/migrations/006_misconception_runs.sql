CREATE TABLE misconception_cluster_runs (
  run_id uuid NOT NULL,
  topic_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  doubts_processed integer NOT NULL DEFAULT 0 CHECK (doubts_processed >= 0),
  clusters_found integer NOT NULL DEFAULT 0 CHECK (clusters_found >= 0),
  error text,
  started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamptz,
  PRIMARY KEY (run_id, topic_id),
  FOREIGN KEY (topic_id, subject_id) REFERENCES topics(id, subject_id) ON DELETE CASCADE
);

ALTER TABLE misconception_clusters
  ADD CONSTRAINT misconception_clusters_run_topic_fk
  FOREIGN KEY (run_id, topic_id)
  REFERENCES misconception_cluster_runs(run_id, topic_id)
  ON DELETE CASCADE;

CREATE INDEX misconception_cluster_runs_topic_latest_idx
  ON misconception_cluster_runs (topic_id, completed_at DESC)
  WHERE status = 'completed';
