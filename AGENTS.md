# Solvix repository guide

## Architecture

Solvix is a monorepo for GATE CS/IT adaptive learning. The existing Flutter client remains at the repository root so its current IDE and platform setup keep working. `backend/api` contains the Express TypeScript API and the separately launched BullMQ worker entrypoint. `ml-service` contains the Python FastAPI service. PostgreSQL with pgvector, Redis, and MinIO-compatible S3 storage (Silo) run locally through Docker Compose. Shared product decisions and API notes live in `docs/`.

## Commands

Run these from the repository root unless noted:

| Task | Command |
| --- | --- |
| Start local infrastructure | Copy `.env.example` to `.env`, then `docker compose up -d` |
| Create Python environment | `py -3.11 -m venv .venv`, then `\.venv\Scripts\Activate.ps1` |
| Install API dependencies | `npm install` |
| Install ML dependencies | With `.venv` active, run `python -m pip install -r ml-service/requirements.txt` |
| Install Flutter dependencies | `flutter pub get` |
| Run API in development | `npm run dev:api` |
| Run doubt worker in development | `npm run dev:worker` |
| Run doubt, weekly archive, and misconception workers | `npm run dev:worker` |
| Build API | `npm run build` |
| Run API tests | `npm test` |
| Run ML service tests | From `ml-service` with `.venv` active, run `python -m unittest test_main` |
| Lint API | `npm run lint` |
| Apply database migrations | `npm run db:migrate` |
| Seed clearly labelled sample content | Apply migrations, start the ML service, then `npm run db:seed`; this loads demo MCQs and draft short-answer data from `content/import/Solvix_data.csv` |
| Export labelled misconception clusters | `npm run export:misconceptions` |
| Run clearly labelled in-memory synthetic practice simulation | `npm run simulate:students` |
| Install research evaluation dependencies | With `.venv` active, run `python -m pip install -r scripts/requirements.txt` |
| Evaluate persisted research outcomes (read-only DB access) | `npm run evaluate:research` with `.venv` active |
| Run research metric unit tests | With `.venv` active, run `python -m unittest discover -s scripts -p "test_*.py"` |
| Run Flutter app | From the repository root, run `flutter run --dart-define=SOLVIX_API_URL=http://10.0.2.2:3000/api/v1` on Android emulator |
| Test Flutter app | `flutter test` |
| Analyze Flutter app | `flutter analyze --no-fatal-infos` |
| Run ML service | With `.venv` active, run `python -m uvicorn main:app --reload --app-dir ml-service` |

Use Node.js 20, Flutter/Dart versions declared by the Flutter package, and Python 3.11 for the ML service. The API reads secrets and connection settings from `.env`; never commit `.env` or credentials.

## Conventions

- Keep HTTP handlers thin; validate input with Zod and put persistence behind small repository interfaces.
- Keep database changes in ordered SQL migrations under `backend/api/src/db/migrations`.
- Keep public question serializers free of answer keys and worked solutions; reserve those for admin routes and the later submission flow.
- Support MCQ, MSQ, NAT, and short-answer question types; keep imported short-answer data clearly labelled when the source has no choices or worked solution.
- Generate embeddings through the ML service only. Never substitute canned vectors for failed production embedding calls.
- Keep API and worker processes separate. The worker must not be started as an API side effect.
- Doubt requests use a Redis-backed BullMQ queue and remain pollable at `GET /api/v1/doubts/:id`; Socket.IO only delivers updates to the authenticated user's room.
- Weekly leaderboard counts are durable in PostgreSQL and projected into a timezone-specific Redis sorted set; reads reconcile the active week, and the worker archives finished weeks.
- Adaptive practice updates per-topic skill and per-question difficulty estimates transactionally, records every rating event, prioritizes due resurfacing, and exposes API-backed ECE progress.
- Peer doubts use authenticated, bounded API routes, subject/topic filters, optional anonymous authorship, and per-user Redis posting limits.
- User exports omit credentials; confirmed account deletion removes database cascades, private uploads, the active leaderboard entry, and revokes existing sessions.
- Misconception clustering is queued to the separate worker, which sends anonymized topic doubts to the FastAPI UMAP/HDBSCAN endpoint. Admin labels are required before tagged hints are returned to students.
- ECE uses confidence probability `(raw - 1) / 4` and equal-width bins across backend and Flutter implementations.
- Route all model calls through the provider interface; tests must use deterministic mocks.
- Label synthetic/demo data and never invent evaluation metrics.
- Keep synthetic simulation outputs separate from real-data evaluation; the simulator must not write learner rows to PostgreSQL.
- Evaluation reads PostgreSQL read-only, exports aggregate metrics only, and leaves metrics blank when there is insufficient observed data.
- Add focused tests for core behavior and update `docs/DECISIONS.md` when resolving a material ambiguity.
- Use explicit names, small functions, and comments for research logic rather than clever abstractions.
