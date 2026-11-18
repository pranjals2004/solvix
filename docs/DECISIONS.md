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
+ **Use original demo practice questions for local seeding instead of empty placeholder text.** Each seed row includes options, a grading key, and a worked explanation so the practice flow can be demonstrated end to end. They remain labelled demo material, are not PYQs or instructor-reviewed, and are not research results.

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
- **Rewrite the signed-upload host for local browser origins during development.** Flutter web runs on a changing localhost port while storage uses port 9000; use the browser's loopback hostname with the configured storage port. Native clients without an `Origin` keep the configured endpoint, and production never rewrites it.

## Phase 5

- **Persist one leaderboard credit per user, question, and Monday week in PostgreSQL.** The Redis sorted set is a rebuildable active-week projection, so a failed Redis update cannot lose earned credit.
- **Count only the first correct attempt per question in a week, and require at least ten seconds.** All attempts remain in submission history; repeats and short attempts receive an explicit reason in the response.
- **Flag an account after five sub-ten-second attempts in ten minutes.** The flag is durable and exposed through an administrator-only review endpoint; it does not automatically remove prior valid credits.
- **Encode solved count and the time the current count was reached in the Redis score.** Counts dominate score, then reaching the count earlier ranks higher; stable user-id ordering resolves exact ties in archive output.
- **Use BullMQ's timezone-aware weekly scheduler at Sunday 23:59.** The scheduled worker archives ranks from durable PostgreSQL rows and the next Monday week uses a separate Redis key.

## Phase 6

- **Use one confidence-weighted Elo formula for the `conf_elo` arm and standard Elo for both other arms.** Random assignment remains random at selection time, while its standard-Elo rating events provide an outcome-only comparison group.
- **Initialize skill and item estimates at 1000, with `ELO_K`, `ELO_GAMMA`, `ELO_EPSILON`, `ELO_SIGMA`, and the optional weighting parameters configurable through environment variables.** The optional `W(C,S,E) = 1 + α·max(0,C−E)·1[S=0] + β·max(0,E−C)·1[S=1]` over/under-confidence weighting variant is disabled by default.
- **Choose the closest question to the student's skill plus Gaussian noise from questions in the configured rating window.** If none fit the window, restrict the pool to the nearest available difficulty; avoid questions attempted in the last seven days when alternatives exist.
- **Claim due resurface rows transactionally and suppress another delivery for six hours.** A miss resets the HLR-inspired sequence to one day; a correct answer on a due item advances to 3, 7, then 14 days.
- **Compute ECE from the most recent 2,000 rating events with confidence mapped by `(raw - 1) / 4`.** The mobile app uses the same equal-width-bin formula and reports no-data state instead of a fabricated value.

## Phase 7

- **Cluster completed, topic-linked doubts and cap each topic run at the 1,000 newest records.** UMAP and HDBSCAN run in the ML service with fixed seeds; topic samples below six remain unclustered because a low-sample manifold is not stable enough to label.
- **Remove email addresses and each author's known name before sending doubt text to the ML service.** Exemplar text returned to the admin endpoint is anonymized with the same helper.
- **Persist run state separately from discovered clusters.** This lets an empty completed run supersede stale labels, while failed runs leave the last successful student hints available.
- **Only completed clusters with a human label and a current user tag are surfaced to that student.** New cluster labels always begin empty and require admin review.
- **Run clustering each Monday at 02:00 in `LEADERBOARD_TIMEZONE` and expose an admin-only manual queue trigger.** Topic runs are transactionally replaced on retry using a stable run ID.
- **Export only cluster labels and aggregate counts.** Share of doubt volume uses cluster size divided by the number of doubts processed in that topic's latest run; no student identifiers or raw text are exported.

## Home follow-up

- **Use the home screen as a live adaptive-practice entry point.** Show attempt counts and accuracy from the authenticated progress endpoint; recommend the attempted topic with the lowest current skill rating and request its next question through the topic-scoped practice endpoint. If the student has no attempts yet, direct them to the Study library instead of showing mock progress or a fabricated recommendation.
- **Refresh progress after an adaptive attempt.** Returning from a submitted question invalidates the progress provider so the home recommendation reflects the new server-side rating and attempt history.

## Study-library follow-up

- **Complete the student study library with API-backed topic notes.** Notes are loaded from the existing public content endpoint, shown in a topic-scoped list, and opened in a selectable reader that supports the same plain text and LaTeX content as the API. Reading progress and bookmarks stay out of this phase because the API does not persist either state.
- **Seed one explicitly labelled demo note for each sample topic.** The existing seed command must create retrievable study content so the notes reader can be exercised end to end; embeddings still come from the ML service, and the demo label tells students to verify and replace the material before relying on it.

## Chrome development follow-up

- **Treat Chrome as a supported local development target.** When no API URL is explicitly supplied, web builds use `localhost`; Android emulators continue to use `10.0.2.2`. An explicit `SOLVIX_API_URL` always takes precedence.
- **Keep doubt image selection usable in browsers and native apps.** Preview the selected image from bytes supplied by `image_picker`, rather than a `dart:io` file path, while keeping the same private presigned upload flow.

## Local infrastructure follow-up

- **Use the maintained `pgsty/silo` image for local S3-compatible storage.** The former `minio/minio` and `minio/mc` image references are no longer pullable; Silo preserves the MinIO S3 API, `MINIO_*` settings, health route, and local data format. The compose initializer uses Silo's bundled `mcli` client. The service remains named `minio` so application endpoints and local configuration do not change.

## Phase 8: peer board and privacy

- **Use the existing peer doubt tables, extended with subject/topic and anonymous-author fields.** The API enforces authenticated, bounded thread and reply inputs, subject/topic consistency, and per-user posting limits; Flutter shows empty, retry, and discussion states.
- **Treat account deletion as a coordinated privacy action.** Export data before deletion when desired; deletion removes user-owned database rows through foreign-key cascades, private image objects, the active leaderboard projection, and all existing sessions through a deleted-account marker.
- **Keep the account export JSON-only and exclude password hashes and other credentials.** The Flutter profile provides a direct copy action for personal storage.

## Phase 9: evaluation tooling

- **Keep synthetic simulations in memory and export them to a separate labelled file.** A fixed synthetic learner model exercises selection, confidence, grading, and Elo updates without adding synthetic accounts or submissions to the real database.
- **Evaluate stored outcomes read-only, grouped by assigned arm and local week.** Bootstrap learner-week accuracy means rather than individual attempts, use the project ECE bins, and export only aggregates. Leave unavailable metrics blank; observational reports do not establish causal superiority.

## Imported question dataset

- **Keep the supplied question/answer CSV as short-answer practice because it has no option choices or worked solutions.** Do not invent distractors or claim it is a PYQ source. Imported questions and notes are labelled draft content, and short-answer grading ignores case and repeated whitespace while otherwise matching the stored answer exactly.
