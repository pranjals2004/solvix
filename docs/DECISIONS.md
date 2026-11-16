# Decisions

## Phase 1

- **Keep the existing Flutter package at repository root.** It was already configured and in active IDE use, while the environment prevents safely renaming its platform directories. Adding the backend and ML service alongside it preserves the project while establishing a monorepo; relocating the client can be revisited if the workspace layout changes.
- **Use the `pg` driver with SQL migrations.** This keeps PostgreSQL and pgvector features explicit and makes the schema easy to inspect in a final-year project review.
- **Use `express-rate-limit` with `rate-limit-redis` for request throttling.** This follows the selected stack, and the dependency tree is checked at install time.
- **Use Biome for TypeScript linting.** The installed tree avoids the TypeScript ESLint parser advisory present in the registry metadata while retaining TypeScript-aware lint checks.
- **Use one Express API workspace and a separately launched worker.** Worker code is introduced alongside the queue-backed doubt feature so the process is never presented as operational before it can consume jobs.
- **Assign experiment arms under a transaction-scoped advisory lock.** Choosing the least populated arm while holding this lock produces balanced signup assignment under concurrent registration.
- **Treat the local `.env.example` values as disposable local-only values.** No production credential belongs in the repository; `.env` is ignored.
- **Represent consent at account creation.** Registration rejects absent consent, and stores the timestamp with the account.

## Phase 2

- **Keep note bodies separate from retrieval chunks.** `notes` stores the original content returned to the viewer; `note_chunks` stores overlapping chunks and embeddings for retrieval. Question solutions use `note_chunks` with `source_type = 'solution'`.
- **Chunk long source content at 1,200 characters with 150 characters of overlap.** This is a simple deterministic baseline that keeps source ordering and avoids introducing another content-processing dependency.
- **Require the ML service for writes that create retrieval content.** If embeddings are unavailable or malformed, the API rejects the write/import instead of persisting content that cannot be retrieved. No synthetic vectors are used.
- **Use slugs for CSV imports and UUIDs for JSON imports.** CSV stays readable for spreadsheet editing, while JSON can preserve stable database IDs for repeatable imports.
- **Label seed questions as synthetic placeholders.** They demonstrate question types and subject/topic setup, but are not represented as authentic GATE questions or research results.

## Phase 3

- **Add the minimal submission endpoint alongside the Flutter attempt flow.** Content question reads intentionally omit answers, so the client must submit an authenticated attempt to receive grading and the worked solution. Confidence and time are recorded now; ranking and rating updates remain assigned to their later phases.
- **Store the access token with platform secure storage.** This preserves a signed-in session across app restarts without putting the JWT in ordinary preferences.
- **Keep the research preview screens out of the signed-in navigation until their API phases are implemented.** The Phase 3 home and profile avoid presenting the earlier UI prototype's synthetic progress figures as account data.

## Phase 4

- **Use an `Idempotency-Key` request header for initial doubt submission.** The key is unique per user and maps to one persistent doubt row; the UUID row id is also the BullMQ job id. Follow-up messages accept a client message UUID and use a separate deterministic queue id.
- **Keep image keys user-prefixed and private.** Uploads are JPEG, PNG, or WebP, limited to 5 MB, signed for five minutes, and revalidated from object metadata by the worker before vision processing.
- **Keep the ML service as the only embedding implementation.** The worker retrieves three context chunks from pgvector, with the linked question solution and same-topic chunks preferred before global semantic matches.
- **Use provider-specific REST adapters behind one `LLMProvider` interface.** Gemini remains the default, and a deterministic mock is used unless `LLM_MODE=live` is explicitly selected.
- **Allow one follow-up request at a time.** This keeps each stateless LLM request's full conversation history ordered and prevents concurrent completions from overwriting one another.
- **Separate the object's private and signed-upload addresses.** The API and worker use `S3_ENDPOINT`; presigned phone uploads use `S3_PUBLIC_ENDPOINT` so Android emulator, iOS simulator, and physical-device routing can be configured without exposing private worker traffic.
