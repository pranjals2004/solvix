# Scripts

Run commands from the repository root.

## Seed local demo content

Apply migrations, start the API dependencies and ML service, then run `npm run db:seed`. The seed upserts demo MCQs and imports the four choices, answer key, and worked solution for each question in `content/import/gate_cse_subjects_v2.csv`. It also seeds study notes. The questions are practice content and are not marked as official GATE PYQs. The ML service creates embeddings for retrieval content; the seed fails rather than writing fixed or placeholder vectors if embedding generation is unavailable. This content is for local development and must not be treated as research data.

## Export misconception clusters

Run `npm run export:misconceptions` to export reviewed cluster labels and aggregate counts. The export omits learner identifiers and raw doubt text.

## Evaluate adaptive practice

Run `npm run evaluate:adaptive` after the database has stored learner submissions. The script groups registered students and persisted attempts by assigned experiment arm (`random`, `standard_elo`, and `conf_elo`) and writes aggregate CSV to `exports/adaptive-evaluation.csv`. Set `ADAPTIVE_EVALUATION_PATH` to choose another output path.

The quick report contains registered students, participants, attempts, accuracy, response-time summaries, and ECE. It uses observed database records and does not create learner records or simulate outcomes.

## Synthetic practice simulation

Install the Python reporting dependencies with `python -m pip install -r scripts/requirements.txt`. Run `npm run simulate:students` to exercise random, standard Elo, and confidence-weighted Elo selection/update loops using seeded synthetic learners. The default output is `exports/synthetic-adaptive-simulation.csv`; configure `SIMULATION_LEARNERS_PER_ARM`, `SIMULATION_ATTEMPTS_PER_LEARNER`, `SIMULATION_SEED`, or `SYNTHETIC_SIMULATION_PATH` to change the demo.

Learners have synthetic latent skill levels and confidence biases. The fixed seed makes a run reproducible. Every row is marked `SYNTHETIC_NOT_RESEARCH_DATA`; the script does not create accounts or write to PostgreSQL. These outcomes demonstrate code paths only and must not be included in pilot evaluation.

## Research evaluation

Run `npm run evaluate:research` after installing `scripts/requirements.txt` and starting PostgreSQL. It reads `.env` (or the process environment), uses a read-only database connection, and writes `exports/evaluation/real-evaluation.csv` plus PNG charts. See [../docs/EVALUATION.md](../docs/EVALUATION.md) for metric definitions, confidence intervals, and data limitations.
