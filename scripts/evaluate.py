"""Generate aggregate, real-data evaluation CSV and PNG charts."""

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import dotenv_values

from scripts.evaluation import build_metrics, load_database_snapshot, write_csv
from scripts.evaluation_plots import write_plots

ROOT = Path(__file__).resolve().parents[1]


def load_config() -> dict[str, str]:
    file_values = {key: value for key, value in dotenv_values(ROOT / ".env").items() if value is not None}
    return {**file_values, **os.environ}


def main() -> int:
    config = load_config()
    database_url = config.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required; set it in the repository .env or process environment.")

    timezone_name = config.get("LEADERBOARD_TIMEZONE", "Asia/Kolkata")
    report_timezone = ZoneInfo(timezone_name)
    bootstrap_seed = read_integer(config, "EVALUATION_BOOTSTRAP_SEED", 20261117)
    bootstrap_replicates = read_integer(config, "EVALUATION_BOOTSTRAP_REPLICATES", 2000)
    if bootstrap_replicates < 100:
        raise ValueError("EVALUATION_BOOTSTRAP_REPLICATES must be at least 100.")

    snapshot = load_database_snapshot(database_url, timezone_name)
    rows = build_metrics(
        snapshot,
        timezone_name=timezone_name,
        current_date=datetime.now(report_timezone).date(),
        bootstrap_seed=bootstrap_seed,
        bootstrap_replicates=bootstrap_replicates,
    )

    output_dir = Path(config.get("EVALUATION_OUTPUT_DIR", "exports/evaluation"))
    if not output_dir.is_absolute():
        output_dir = ROOT / output_dir
    csv_path = output_dir / "real-evaluation.csv"
    write_csv(rows, csv_path)
    plot_paths = write_plots(rows, output_dir)
    attempt_count = sum(
        row["attempt_count"] or 0 for row in rows if row["metric"] == "weekly_ece"
    )
    print(f"Wrote descriptive metrics for {attempt_count} stored student attempts to {csv_path}")
    print("The report uses aggregate real-observed data; learner IDs and raw doubt text are not written.")
    for path in plot_paths:
        print(f"Wrote plot: {path}")
    return 0


def read_integer(config: dict[str, str], name: str, default: int) -> int:
    raw = config.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Evaluation failed: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1) from error
