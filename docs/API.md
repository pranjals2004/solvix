# API (Phases 1–3)

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
| POST/PATCH/DELETE | `/admin/subjects` and `/admin/subjects/:subjectId` | Admin subject management |
| POST | `/admin/subjects/:subjectId/topics` | Admin topic creation |
| PATCH/DELETE | `/admin/topics/:topicId` | Admin topic management |
| GET/POST/PATCH/DELETE | `/admin/questions` and `/admin/questions/:questionId` | Admin question management, including answer keys and worked solutions; solutions are embedded |
| POST/PATCH/DELETE | `/admin/notes` and `/admin/notes/:noteId` | Admin note management; note chunks are embedded |
| POST | `/admin/import` | Bulk JSON and/or CSV import, up to 100 questions and 100 notes per request |

Authenticated routes use `Authorization: Bearer <access-token>`. Registration returns HTTP 201 and login returns HTTP 200, each with `{token,user}`. Passwords are bcrypt-hashed. Access JWTs carry a unique `jti`; logout stores it in Redis until token expiry. Registration rejects absent consent. Admin routes require a JWT whose role is `admin`. To grant the first administrator after registration, run an operator-controlled SQL update such as `UPDATE users SET role = 'admin' WHERE lower(email) = lower('admin@example.edu');`; issue a fresh login afterward so the token contains the updated role. CSV imports use subject/topic slugs and the headers in `content/templates`; JSON imports use UUIDs. Imported note bodies and question solutions are never exposed by public question routes.

Requests under `/api/v1` share a Redis-backed limit of 120 requests per IP address per 60-second window. Responses use the standard `RateLimit` headers; excess requests receive HTTP 429.

`POST /submissions` requires a bearer token and a body such as `{ "questionId": "<UUID>", "answer": "A", "timeTakenSec": 18, "confidence": 4 }`. Confidence is an integer from 1 to 5. Submit MCQ labels such as `"A"`, MSQ label arrays such as `["A", "C"]`, and NAT numbers or numeric strings. The endpoint records each attempt and returns correctness, attempt number, and the worked solution. Leaderboard counting and adaptive rating updates are added in their later phases.
