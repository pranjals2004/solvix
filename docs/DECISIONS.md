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
