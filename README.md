# Solvix

Solvix is an AI-assisted adaptive learning platform for GATE Computer Science and Information Technology preparation. The repository contains the Flutter app, a TypeScript API, a Python ML service, local infrastructure, and research tooling.

## Local setup

1. Install Node.js 20, Flutter, Python 3.11, and Docker Compose.
2. Create and activate a project Python environment: `py -3.11 -m venv .venv`, then `.\.venv\Scripts\Activate.ps1`.
3. Copy `.env.example` to `.env` and adjust local values if needed.
4. Start PostgreSQL with pgvector, Redis, and local MinIO-compatible S3 storage (Silo): `docker compose up -d`.
5. Install API dependencies: `npm install`.
6. Install ML dependencies: `python -m pip install -r ml-service/requirements.txt`. To use research reports, also install `python -m pip install -r scripts/requirements.txt`.
7. Apply schema migrations: `npm run db:migrate`.
8. In a terminal with `.venv` activated, start the ML service: `python -m uvicorn main:app --reload --app-dir ml-service`.
9. Seed demo MCQs, study notes, and 220 four-option questions from `content/import/gate_cse_subjects_v2.csv` with `npm run db:seed`. This updates the same local records on each run and uses the ML service to generate note and solution embeddings. Seeded questions are practice content, not identified as official GATE PYQs.
10. Start the API: `npm run dev:api`.
11. For doubt resolution, start the separate worker in another terminal: `npm run dev:worker`. Keep `LLM_MODE=mock` for deterministic local replies.
12. In another terminal, run the Flutter app from the repository root with `flutter run --dart-define=SOLVIX_API_URL=http://10.0.2.2:3000/api/v1` on an Android emulator. For the iOS simulator, use `http://localhost:3000/api/v1`; for Chrome, use `flutter run -d chrome --dart-define=SOLVIX_API_URL=http://localhost:3000/api/v1`; for a physical phone, use the development machine's LAN address.

The API health check is available at `http://localhost:3000/health`; readiness is at `/ready`. API details are in [docs/API.md](docs/API.md), content templates are in [content/templates](content/templates), and implementation decisions are in [docs/DECISIONS.md](docs/DECISIONS.md).

The example `S3_PUBLIC_ENDPOINT` targets the Android emulator. Flutter web automatically receives a localhost upload URL during development; set `S3_PUBLIC_ENDPOINT=http://localhost:9000` when using the iOS simulator, or use the development machine's LAN address for a physical phone.

Run `npm run export:misconceptions` to export reviewed misconception-cluster aggregates. `npm run simulate:students` writes a clearly labelled synthetic practice-loop demo without creating database accounts. `npm run evaluate:research` reads stored data read-only and produces the research CSV and PNGs; see [docs/EVALUATION.md](docs/EVALUATION.md). Results are descriptive and do not establish causal superiority.

## Local demo flow

1. Open Solvix and register a student account with consent.
2. Open **Study**, choose a subject/topic, read its demo notes, and submit a practice answer with a confidence rating.
3. From Home, open **Peer doubt board** to post a question anonymously or under the account name, then reply to a discussion.
4. Open **Doubts** to ask for a content-grounded explanation. The API and worker use the local ML service; with `LLM_MODE=mock`, the tutor reply is deterministic and does not spend provider quota.
5. Use **Leaderboard** and **Profile → Progress and calibration** to see only data from saved attempts. **Profile → Export my data** copies a credential-free JSON export. The delete control permanently removes the signed-in account and its uploaded images.
6. After collecting real student activity, run `npm run evaluate:research`; the report leaves unsupported metrics blank. Use `npm run simulate:students` only for a separately labelled code-path demo.

## Checks

Run `npm test`, `npm run lint`, and `npm run build` for the API. Run `flutter test` and `flutter analyze --no-fatal-infos` for the existing Flutter app. The client currently reports informational style/deprecation notices; the analyzer command treats those as non-blocking while still failing on warnings and errors.
