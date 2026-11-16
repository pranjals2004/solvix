ALTER TABLE doubt_queries ADD COLUMN idempotency_key text;
CREATE UNIQUE INDEX doubt_queries_user_idempotency_unique
  ON doubt_queries (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
