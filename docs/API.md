# API (Phase 1)

Base path: `/api/v1`. JSON errors use `{ "error": { "code": string, "message": string } }`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness check; no dependency calls |
| GET | `/ready` | Readiness check for PostgreSQL and Redis |
| POST | `/auth/register` | Create a student account; requires `{name,email,password,consent:true}` |
| POST | `/auth/login` | Verify email/password and issue an access token |
| POST | `/auth/logout` | Revoke the current access token in Redis |
| GET | `/auth/me` | Return the authenticated account |

Authenticated routes use `Authorization: Bearer <access-token>`. Registration returns HTTP 201 and login returns HTTP 200, each with `{token,user}`. Passwords are bcrypt-hashed. Access JWTs carry a unique `jti`; logout stores it in Redis until token expiry. Registration rejects absent consent. The remaining endpoints are added in their implementation phases.

Requests under `/api/v1` share a Redis-backed limit of 120 requests per IP address per 60-second window. Responses use the standard `RateLimit` headers; excess requests receive HTTP 429.
