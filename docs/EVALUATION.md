# Research evaluation

Solvix reports metrics from persisted student activity and keeps synthetic demonstrations separate. A report does not by itself establish that one adaptive arm caused better outcomes. Interpret results with the study design, assignment process, sample sizes, missing feedback, and content quality in view.

## Run the tools

Install the script dependencies and start local PostgreSQL:

```powershell
python -m pip install -r scripts/requirements.txt
npm run evaluate:research
```

The evaluator reads `DATABASE_URL` and `LEADERBOARD_TIMEZONE` from the process environment or repository `.env`. It opens PostgreSQL read-only, keeps grouped query results in memory, and writes aggregate output to `exports/evaluation/` by default. Set `EVALUATION_OUTPUT_DIR` to choose another output directory, `EVALUATION_BOOTSTRAP_SEED` for reproducible bootstrap sampling, and `EVALUATION_BOOTSTRAP_REPLICATES` for the number of resamples (minimum 100).

Outputs:

- `real-evaluation.csv`: long-form aggregate rows with dataset label, metric, week, arm or subject, value, sample size, and confidence interval where applicable.
- `accuracy-trajectory.png`: weekly mean student accuracy with 95% bootstrap intervals when estimable.
- `ece-trajectory.png`: expected calibration error by week and arm.
- `weekly-active-rate.png`: weekly active student rate by arm.
- `explanation-helpfulness.png`: student feedback helpfulness by subject.
- `misconception-coverage.png`: clustered and human-labelled doubt-volume shares by subject.

If no real observations exist, rates that require a denominator are blank and plots state that data is unavailable. The evaluator never fills missing values with sample or simulated outcomes. No learner IDs, emails, doubt text, or other raw feedback are written to the report.

## Metric definitions

| Metric | Definition |
| --- | --- |
| Weekly mean student accuracy | Compute each participating student's correct/attempted ratio for that arm and local week, then take the unweighted mean across participating students. `attempt_count` gives the total attempts; `sample_size` gives the number of participating students. |
| 95% accuracy interval | Percentile bootstrap of learner-week accuracy values within each arm and week, resampling students with replacement. The default is 2,000 resamples and a fixed configurable seed. With fewer than two participating students, interval fields are blank instead of reporting a degenerate interval. |
| Weekly ECE | Ten equal-width bins over confidence probability `(confidence_raw - 1) / 4`, matching the API and Flutter definition. It uses all stored student submissions in that arm and week. ECE is blank when that week has no attempts. |
| Weekly active student rate | Unique students with at least one submission or doubt query during the local week divided by all registered student accounts in that arm by that week's end. A week with registered students and no activity has an observed rate of zero. |
| Explanation helpfulness | Helpful student feedback divided by all student feedback ratings, grouped by the subject of the linked question. Feedback on a doubt without a linked question is grouped as `Unlinked doubt`. A subject with no ratings has a blank rate and sample size zero. |
| Misconception coverage | For each subject, use the latest completed clustering run for each topic. Report discovered and labelled cluster counts, clustered doubt volume divided by doubts processed, and the subset of that volume in human-labelled clusters. No raw doubt content or user tags are exported. |

Weeks start on Monday in `LEADERBOARD_TIMEZONE` (default `Asia/Kolkata`). Cluster coverage is based on each topic's latest completed run, so topics with no completed run are not included in the processed-doubt denominator.

## Synthetic practice-loop demonstration

Run `npm run simulate:students`. It writes `exports/synthetic-adaptive-simulation.csv`, separate from the real-data evaluation outputs. Change `SIMULATION_LEARNERS_PER_ARM`, `SIMULATION_ATTEMPTS_PER_LEARNER`, `SIMULATION_SEED`, or `SYNTHETIC_SIMULATION_PATH` to configure a demo.

The simulator calls the production pure question-selection and Elo modules in memory. Its synthetic profiles combine latent skills 800, 1000, and 1200 with confidence biases of -1, 0, and +1 raw confidence points. It samples correctness using the Elo logistic probability for synthetic item difficulties, then derives reported confidence from that probability, the profile bias, and a small seeded jitter. Each row is marked `SYNTHETIC_NOT_RESEARCH_DATA`. The defaults balance 27 generated learners in each arm across those profiles and produce 30 attempts per learner.

The simulator creates no accounts, submissions, or other database rows. Its outcomes are a code-path demonstration, not pilot data, not an evaluation input, and not evidence that one strategy performs better.

## Research questions supported

- **RQ1 — Calibration:** compare weekly ECE for `conf_elo` and `standard_elo`, considering the number of attempts and participants.
- **RQ2 — Accuracy:** inspect weekly accuracy trajectories for the adaptive arms and `random`; account for the observational nature of the comparison.
- **RQ3 — Misconceptions:** inspect latest-run cluster counts and doubt-volume coverage by subject; use the separate labelled-cluster export for human-reviewed descriptions.
- **RQ4 — Explanation helpfulness:** inspect rated helpfulness by subject alongside the number of ratings. Unrated explanations are not counted as negative feedback.

The reports provide descriptive summaries only. No statistical significance test, causal estimate, or fabricated pilot result is produced.
