# Solvix repository guide

## Architecture

Solvix is a monorepo for GATE CS/IT adaptive learning. The existing Flutter client remains at the repository root so its current IDE and platform setup keep working. `backend/api` contains the Express TypeScript API; the separate worker will be added when the doubt pipeline is implemented. `ml-service` contains the Python FastAPI service. PostgreSQL with pgvector, Redis, and MinIO run locally through Docker Compose. Shared product decisions and API notes live in `docs/`.

## Commands

Run these from the repository root unless noted:

| Task | Command |
| --- | --- |
| Start local infrastructure | Copy `.env.example` to `.env`, then `docker compose up -d` |
| Install API dependencies | `npm install` |
| Install ML dependencies | `python -m pip install -r ml-service/requirements.txt` |
| Run API in development | `npm run dev:api` |
| Build API | `npm run build` |
| Run API tests | `npm test` |
| Lint API | `npm run lint` |
| Apply database migrations | `npm run db:migrate` |
| Seed clearly labelled sample content | Start the ML service, then `npm run db:seed` |
| Run Flutter app | From the repository root, run `flutter run` |
| Test Flutter app | `flutter test` |
| Analyze Flutter app | `flutter analyze --no-fatal-infos` |
| Run ML service | `python -m uvicorn main:app --reload --app-dir ml-service` |

Use Node.js 20, Flutter/Dart versions declared by the Flutter package, and Python 3.11 for the ML service. The API reads secrets and connection settings from `.env`; never commit `.env` or credentials.

## Conventions

- Keep HTTP handlers thin; validate input with Zod and put persistence behind small repository interfaces.
- Keep database changes in ordered SQL migrations under `backend/api/src/db/migrations`.
- Keep public question serializers free of answer keys and worked solutions; reserve those for admin routes and the later submission flow.
- Generate embeddings through the ML service only. Never substitute canned vectors for failed production embedding calls.
- Keep API and worker processes separate. The worker must not be started as an API side effect.
- Route all model calls through the provider interface; tests must use deterministic mocks.
- Label synthetic/demo data and never invent evaluation metrics.
- Add focused tests for core behavior and update `docs/DECISIONS.md` when resolving a material ambiguity.
- Use explicit names, small functions, and comments for research logic rather than clever abstractions.
