"""PNG charts for the aggregate real-data evaluation report."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .evaluation import ARMS

COLORS = {"random": "#607d8b", "standard_elo": "#3f51b5", "conf_elo": "#00897b"}


def write_plots(rows: list[dict[str, Any]], output_dir: Path) -> list[Path]:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    output_dir.mkdir(parents=True, exist_ok=True)
    created = [
        _write_weekly_plot(rows, output_dir, plt, "weekly_mean_student_accuracy", "Weekly mean student accuracy", "Accuracy", "accuracy-trajectory.png", True),
        _write_weekly_plot(rows, output_dir, plt, "weekly_ece", "Weekly expected calibration error", "ECE", "ece-trajectory.png", False),
        _write_weekly_plot(rows, output_dir, plt, "weekly_active_student_rate", "Weekly active student rate", "Active rate", "weekly-active-rate.png", False),
        _write_subject_rate_plot(rows, output_dir, plt),
        _write_coverage_plot(rows, output_dir, plt),
    ]
    return created


def _write_weekly_plot(
    rows: list[dict[str, Any]],
    output_dir: Path,
    plt: Any,
    metric: str,
    title: str,
    y_label: str,
    filename: str,
    show_confidence_interval: bool,
) -> Path:
    figure, axis = plt.subplots(figsize=(9, 5))
    metric_rows = [row for row in rows if row["metric"] == metric and row["week_start"]]
    weeks = sorted({row["week_start"] for row in metric_rows if row["value"] is not None})
    has_values = False
    for arm in ARMS:
        arm_rows = {row["week_start"]: row for row in metric_rows if row["arm"] == arm}
        if not any(week in arm_rows and arm_rows[week]["value"] is not None for week in weeks):
            continue
        has_values = True
        x_positions = list(range(len(weeks)))
        values = [
            float(arm_rows[week]["value"])
            if week in arm_rows and arm_rows[week]["value"] is not None
            else float("nan")
            for week in weeks
        ]
        axis.plot(x_positions, values, marker="o", label=arm, color=COLORS[arm])
        if show_confidence_interval and any(
            week in arm_rows and arm_rows[week]["lower_95_ci"] is not None for week in weeks
        ):
            lows = [
                float(arm_rows[week]["lower_95_ci"])
                if week in arm_rows and arm_rows[week]["lower_95_ci"] is not None
                else float("nan")
                for week in weeks
            ]
            highs = [
                float(arm_rows[week]["upper_95_ci"])
                if week in arm_rows and arm_rows[week]["upper_95_ci"] is not None
                else float("nan")
                for week in weeks
            ]
            axis.fill_between(x_positions, lows, highs, alpha=0.14, color=COLORS[arm])
    if has_values:
        axis.set_xticks(list(range(len(weeks))), weeks, rotation=30, ha="right")
        axis.legend()
    else:
        axis.text(0.5, 0.5, "No observed data", ha="center", va="center", transform=axis.transAxes)
    axis.set_title(title)
    axis.set_ylabel(y_label)
    axis.set_xlabel("Week starting (local time)")
    axis.set_ylim(0, 1)
    axis.grid(True, alpha=0.25)
    figure.tight_layout()
    path = output_dir / filename
    figure.savefig(path, dpi=160)
    plt.close(figure)
    return path


def _write_subject_rate_plot(rows: list[dict[str, Any]], output_dir: Path, plt: Any) -> Path:
    figure, axis = plt.subplots(figsize=(10, 5))
    series = sorted(
        (row for row in rows if row["metric"] == "explanation_helpfulness_rate"),
        key=lambda row: row["subject"],
    )
    available = [row for row in series if row["value"] is not None]
    if available:
        axis.bar([row["subject"] for row in available], [row["value"] for row in available], color="#3f51b5")
        axis.set_ylim(0, 1)
        axis.tick_params(axis="x", rotation=25)
    else:
        axis.text(0.5, 0.5, "No observed data", ha="center", va="center", transform=axis.transAxes)
    axis.set_title("Explanation helpfulness by subject")
    axis.set_ylabel("Helpful rate")
    axis.grid(axis="y", alpha=0.25)
    figure.tight_layout()
    path = output_dir / "explanation-helpfulness.png"
    figure.savefig(path, dpi=160)
    plt.close(figure)
    return path


def _write_coverage_plot(rows: list[dict[str, Any]], output_dir: Path, plt: Any) -> Path:
    figure, axis = plt.subplots(figsize=(10, 5))
    clustered = {row["subject"]: row["value"] for row in rows if row["metric"] == "clustered_doubt_volume_share"}
    labelled = {row["subject"]: row["value"] for row in rows if row["metric"] == "labelled_doubt_volume_share"}
    subjects = sorted(set(clustered) | set(labelled))
    available = [subject for subject in subjects if clustered[subject] is not None or labelled[subject] is not None]
    if available:
        positions = list(range(len(available)))
        width = 0.38
        axis.bar(
            [position - width / 2 for position in positions],
            [clustered[subject] if clustered[subject] is not None else 0 for subject in available],
            width,
            label="Clustered doubt share",
            color="#607d8b",
        )
        axis.bar(
            [position + width / 2 for position in positions],
            [labelled[subject] if labelled[subject] is not None else 0 for subject in available],
            width,
            label="Human-labelled doubt share",
            color="#00897b",
        )
        axis.set_xticks(positions, available, rotation=25, ha="right")
        axis.set_ylim(0, 1)
        axis.legend()
    else:
        axis.text(0.5, 0.5, "No completed clustering data", ha="center", va="center", transform=axis.transAxes)
    axis.set_title("Misconception clustering coverage by subject")
    axis.set_ylabel("Share of doubts processed")
    axis.grid(axis="y", alpha=0.25)
    figure.tight_layout()
    path = output_dir / "misconception-coverage.png"
    figure.savefig(path, dpi=160)
    plt.close(figure)
    return path
