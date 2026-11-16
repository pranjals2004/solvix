ALTER TABLE resurface_queue
  ADD COLUMN last_presented_at timestamptz;

CREATE INDEX resurface_queue_presented_idx
  ON resurface_queue (user_id, due_at, last_presented_at);
