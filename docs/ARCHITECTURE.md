# Architecture

```mermaid
flowchart LR
  M[Flutter client] -->|HTTPS /api/v1| A[Express API]
  M <-->|Socket.IO + polling fallback| A
  A --> P[(PostgreSQL + pgvector)]
  A --> R[(Redis)]
  A -->|leaderboard projection| R
  A -->|ranked weekly rows| P
  A --> S[MinIO private uploads]
  A --> ML[FastAPI embeddings]
  A -->|HTTP 202 + jobId=doubtId| Q[BullMQ queue]
  Q --> W[Separate BullMQ worker]
  W -->|Sunday 23:59 local archive| P
  W --> P
  W --> R
  W --> L[LLMProvider]
  W --> ML[FastAPI ML service]
```

The API owns authentication, validation, synchronous product endpoints, initial doubt requests, and weekly count projection. PostgreSQL stores the distinct question credited per user and week; the Redis sorted set orders the active week and can be rebuilt from those durable rows. The separate worker resolves doubts with the platform's pgvector content and a provider-agnostic LLM interface, and archives the leaderboard on its timezone-based weekly schedule. The Flutter client uses Dio with a secure token store, and receives doubt results over authenticated per-user Socket.IO rooms or status polling. Redis supports short-lived tokens, rate limits, queues, realtime coordination, and leaderboard scores; MinIO stores private user uploads. The Python service owns embeddings and clustering. Flutter remains in the repository root to preserve the pre-existing project setup (see `docs/DECISIONS.md`).

## Phase 1 runtime boundary

The API is split into an application factory and a server entrypoint. Tests inject repository and Redis interfaces. Production startup connects Redis before creating the rate-limit store, then starts the API. `/health` reports process liveness; `/ready` checks PostgreSQL and Redis.
