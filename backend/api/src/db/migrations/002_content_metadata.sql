ALTER TABLE note_chunks
  ADD COLUMN title text NOT NULL DEFAULT 'Untitled content',
  ADD COLUMN chunk_index integer NOT NULL DEFAULT 0 CHECK (chunk_index >= 0);

CREATE TABLE notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  topic_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id, subject_id) REFERENCES topics(id, subject_id) ON DELETE RESTRICT
);
CREATE INDEX notes_topic_updated_idx ON notes (topic_id, updated_at DESC);

CREATE UNIQUE INDEX note_chunks_source_chunk_unique
  ON note_chunks (source_type, source_id, chunk_index);
CREATE INDEX note_chunks_topic_source_idx
  ON note_chunks (topic_id, source_type, source_id);
