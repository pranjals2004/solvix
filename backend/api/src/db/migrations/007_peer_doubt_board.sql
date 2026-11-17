ALTER TABLE peer_doubt_threads
  ADD COLUMN subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  ADD COLUMN topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;

ALTER TABLE peer_doubt_threads
  ADD CONSTRAINT peer_doubt_threads_topic_subject_fk
  FOREIGN KEY (topic_id, subject_id) REFERENCES topics(id, subject_id);

CREATE INDEX peer_doubt_threads_subject_created_idx
  ON peer_doubt_threads (subject_id, created_at DESC);
CREATE INDEX peer_doubt_threads_topic_created_idx
  ON peer_doubt_threads (topic_id, created_at DESC);
