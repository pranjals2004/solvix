# Solvix

Solvix is an AI-assisted adaptive learning platform for GATE Computer Science and Information Technology preparation. The repository contains the Flutter app, a TypeScript API, a Python ML service, local infrastructure, and research tooling.

## Local setup

1. Install Node.js 20, Flutter, Python 3.11, and Docker Compose.
2. Copy `.env.example` to `.env` and adjust local values if needed.
3. Start PostgreSQL with pgvector, Redis, and MinIO: `docker compose up -d`.
4. Install API dependencies: `npm install`.
5. Apply schema migrations: `npm run db:migrate`.
6. Start the API: `npm run dev:api`.
7. In another terminal, run the Flutter app from the repository root with `flutter run`.

The API health check is available at `http://localhost:3000/health`; readiness is at `/ready`. API details are in [docs/API.md](docs/API.md), and implementation decisions are in [docs/DECISIONS.md](docs/DECISIONS.md).

## Checks

Run `npm test`, `npm run lint`, and `npm run build` for the API. Run `flutter test` and `flutter analyze --no-fatal-infos` for the existing Flutter app. The client currently reports informational style/deprecation notices; the analyzer command treats those as non-blocking while still failing on warnings and errors.
