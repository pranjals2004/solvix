# API

Base path: `/api/v1`. JSON errors use `{ "error": { "code": string, "message": string } }`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness check; no dependency calls |
| GET | `/ready` | Readiness check for PostgreSQL and Redis |
| POST | `/auth/register` | Create a student account; requires `{name,email,password,consent:true}` |
| POST | `/auth/login` | Verify email/password and issue an access token |
| POST | `/auth/logout` | Revoke the current access token in Redis |
| GET | `/auth/me` | Return the authenticated account |
| GET | `/subjects` | List subjects |
| GET | `/subjects/:subjectId/topics` | List a subject's topics |
| GET | `/questions` | Browse questions; filters: `subjectId`, `topicId`, `pyq`, `year`, `limit`, `offset` |
| GET | `/questions/:questionId` | Get a question without its answer key or worked solution |
| GET | `/notes?topicId=` | List notes for a topic |
| POST | `/submissions` | Authenticated question attempt; validates confidence 1–5 and returns correctness plus the worked solution |
| POST | `/uploads/presign` | Authenticated short-lived private image upload URL; JPEG/PNG/WebP, maximum 5 MB |
| POST | `/doubts` | Create a doubt and enqueue resolution; returns HTTP 202 with `{doubtId,jobId,status}` |
| GET | `/doubts/:id` | Poll an owned doubt for status, conversation, AI response, and error |
| POST | `/doubts/:id/messages` | Queue one follow-up with the full conversation resent to the model; returns HTTP 202 |
| POST | `/doubts/:id/feedback` | Save or update `{helpful:boolean}` feedback for an owned doubt |
| POST/PATCH/DELETE | `/admin/subjects` and `/admin/subjects/:subjectId` | Admin subject management |
| POST | `/admin/subjects/:subjectId/topics` | Admin topic creation |
| PATCH/DELETE | `/admin/topics/:topicId` | Admin topic management |
| GET/POST/PATCH/DELETE | `/admin/questions` and `/admin/questions/:questionId` | Admin question management, including answer keys and worked solutions; solutions are embedded |
| POST/PATCH/DELETE | `/admin/notes` and `/admin/notes/:noteId` | Admin note management; note chunks are embedded |
| POST | `/admin/import` | Bulk JSON and/or CSV import, up to 100 questions and 100 notes per request |

Authenticated routes use `Authorization: Bearer <access-token>`. Registration returns HTTP 201 and login returns HTTP 200, each with `{token,user}`. Passwords are bcrypt-hashed. Access JWTs carry a unique `jti`; logout stores it in Redis until token expiry. Registration rejects absent consent. Admin routes require a JWT whose role is `admin`. To grant the first administrator after registration, run an operator-controlled SQL update such as `UPDATE users SET role = 'admin' WHERE lower(email) = lower('admin@example.edu');`; issue a fresh login afterward so the token contains the updated role. CSV imports use subject/topic slugs and the headers in `content/templates`; JSON imports use UUIDs. Imported note bodies and question solutions are never exposed by public question routes.

Requests under `/api/v1` share a Redis-backed limit of 120 requests per IP address per 60-second window. Responses use the standard `RateLimit` headers; excess requests receive HTTP 429.

`POST /submissions` requires a bearer token and a body such as `{ "questionId": "<UUID>", "answer": "A", "timeTakenSec": 18, "confidence": 4 }`. Confidence is an integer from 1 to 5. Submit MCQ labels such as `"A"`, MSQ label arrays such as `["A", "C"]`, and NAT numbers or numeric strings. The endpoint records each attempt and returns correctness, attempt number, and the worked solution. Leaderboard counting and adaptive rating updates are added in their later phases.

`POST /uploads/presign` accepts `{ "contentType": "image/png", "contentLength": 12345 }`. Upload the bytes to the returned `uploadUrl` with the same content type, then pass the returned `imageKey` to `POST /doubts`. Keys are private and scoped to the authenticated user. The URL expires after five minutes.

`POST /doubts` accepts at least one of `text` (up to 4,000 characters) or an uploaded `imageKey`, and an optional `questionId`. Send a stable `Idempotency-Key` header for safe retries. The API inserts a pending record, adds a BullMQ `resolve` job whose ID is the doubt UUID, and responds with 202. Duplicate keys for one account reuse the same doubt and BullMQ job. Each user's doubt creations, follow-ups, and upload presigns have separate Redis-backed limits.

The separate worker is started with `npm run dev:worker`. It embeds doubt text with the ML service, retrieves up to three question/topic-prioritized chunks from pgvector, adds the linked question and platform solution, reads an optional private image, and calls the selected `LLMProvider`. `LLM_MODE=mock` uses a deterministic offline tutor; `LLM_MODE=live` selects Gemini by default or Anthropic/OpenAI with the matching API key and model settings. The worker retries up to five times with exponential backoff. Socket.IO updates are sent only to the user room authenticated by the access token; polling remains available if sockets cannot connect. Every returned reply is marked AI-generated and ends with one diagnostic question. `S3_ENDPOINT` is the API/worker's private object-store address, while `S3_PUBLIC_ENDPOINT` is the address the phone uses for the presigned upload (the example targets the Android emulator; set it to `localhost` for the iOS simulator or your LAN address for a physical phone).
