CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE user_role AS ENUM ('student', 'admin');
CREATE TYPE experiment_arm AS ENUM ('random', 'standard_elo', 'conf_elo');
CREATE TYPE question_type AS ENUM ('mcq', 'msq', 'nat');
CREATE TYPE note_source_type AS ENUM ('note', 'solution');
CREATE TYPE doubt_status AS ENUM ('pending', 'processing', 'done', 'failed');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  email text NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consent_given_at timestamptz NOT NULL,
  is_flagged boolean NOT NULL DEFAULT false,
  arm experiment_arm NOT NULL DEFAULT 'random'
);
CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));

CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE
);

CREATE TABLE topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL,
  UNIQUE (subject_id, slug),
  UNIQUE (id, subject_id)
);

CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  topic_id uuid NOT NULL,
  type question_type NOT NULL,
  statement_latex text NOT NULL,
  options_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer_json jsonb NOT NULL,
  nat_tolerance numeric,
  solution_latex text NOT NULL,
  is_pyq boolean NOT NULL DEFAULT false,
  pyq_year smallint,
  difficulty_rating integer NOT NULL DEFAULT 1000,
  attempt_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id, subject_id) REFERENCES topics(id, subject_id) ON DELETE RESTRICT,
  CHECK ((is_pyq AND pyq_year IS NOT NULL) OR (NOT is_pyq AND pyq_year IS NULL)),
  CHECK (nat_tolerance IS NULL OR nat_tolerance >= 0)
);
CREATE INDEX questions_subject_topic_idx ON questions (subject_id, topic_id);
CREATE INDEX questions_pyq_idx ON questions (is_pyq, pyq_year) WHERE is_pyq;

CREATE TABLE note_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL,
  source_type note_source_type NOT NULL,
  source_id uuid NOT NULL,
  content text NOT NULL,
  embedding vector(384),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id, subject_id) REFERENCES topics(id, subject_id) ON DELETE CASCADE
);
CREATE INDEX note_chunks_topic_idx ON note_chunks (topic_id);
CREATE INDEX note_chunks_embedding_hnsw_idx
  ON note_chunks USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  is_correct boolean NOT NULL,
  time_taken_sec integer NOT NULL CHECK (time_taken_sec >= 0),
  confidence_raw smallint NOT NULL CHECK (confidence_raw BETWEEN 1 AND 5),
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  counted_for_rank boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX submissions_user_created_idx ON submissions (user_id, created_at DESC);
CREATE INDEX submissions_question_idx ON submissions (question_id, user_id);

CREATE TABLE user_skill_estimate (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  rating double precision NOT NULL DEFAULT 1000,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE question_difficulty_estimate (
  question_id uuid PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  rating double precision NOT NULL DEFAULT 1000,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rating_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  rs_before double precision NOT NULL,
  rs_after double precision NOT NULL,
  rq_before double precision NOT NULL,
  rq_after double precision NOT NULL,
  k_eff double precision NOT NULL,
  expected double precision NOT NULL,
  outcome smallint NOT NULL CHECK (outcome IN (0, 1)),
  confidence smallint NOT NULL CHECK (confidence BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX rating_events_user_created_idx ON rating_events (user_id, created_at);

CREATE TABLE doubt_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id uuid REFERENCES questions(id) ON DELETE SET NULL,
  text text,
  image_key text,
  status doubt_status NOT NULL DEFAULT 'pending',
  conversation_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_response text,
  retrieval_context_json jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamptz,
  CHECK (text IS NOT NULL OR image_key IS NOT NULL)
);
CREATE INDEX doubt_queries_user_created_idx ON doubt_queries (user_id, created_at DESC);
CREATE INDEX doubt_queries_status_idx ON doubt_queries (status, created_at);

CREATE TABLE doubt_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doubt_id uuid NOT NULL REFERENCES doubt_queries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  helpful boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (doubt_id, user_id)
);

CREATE TABLE misconception_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  cluster_code text NOT NULL,
  label text,
  size integer NOT NULL DEFAULT 0 CHECK (size >= 0),
  exemplar_doubt_ids uuid[] NOT NULL DEFAULT '{}',
  run_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (run_id, cluster_code)
);
CREATE INDEX misconception_clusters_topic_idx ON misconception_clusters (topic_id, created_at DESC);

CREATE TABLE user_misconception_tags (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cluster_id uuid NOT NULL REFERENCES misconception_clusters(id) ON DELETE CASCADE,
  doubt_id uuid NOT NULL REFERENCES doubt_queries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, cluster_id, doubt_id)
);

CREATE TABLE peer_doubt_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id uuid REFERENCES questions(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX peer_doubt_threads_created_idx ON peer_doubt_threads (created_at DESC);

CREATE TABLE peer_doubt_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES peer_doubt_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX peer_doubt_replies_thread_idx ON peer_doubt_replies (thread_id, created_at);

CREATE TABLE leaderboard_archive (
  week_start date NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  solved_count integer NOT NULL CHECK (solved_count >= 0),
  rank integer NOT NULL CHECK (rank > 0),
  archived_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (week_start, user_id)
);

CREATE TABLE resurface_queue (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  interval_days smallint NOT NULL DEFAULT 1 CHECK (interval_days > 0),
  stage smallint NOT NULL DEFAULT 0 CHECK (stage >= 0),
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX resurface_queue_due_idx ON resurface_queue (user_id, due_at);
