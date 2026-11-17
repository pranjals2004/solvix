"""Read-only evaluation data access and aggregate metric generation."""

from __future__ import annotations

import csv
import random
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from statistics import fmean
from typing import Any
from zoneinfo import ZoneInfo

from .ece import expected_calibration_error_from_counts

ARMS = ("random", "standard_elo", "conf_elo")
CSV_FIELDS = (
    "dataset", "metric", "week_start", "arm", "subject", "value",
    "lower_95_ci", "upper_95_ci", "sample_size", "attempt_count", "generated_at",
)


def week_start_for(value: datetime, timezone_name: str) -> date:
    local_date = value.astimezone(ZoneInfo(timezone_name)).date()
    return local_date - timedelta(days=local_date.weekday())


def bootstrap_mean_ci(
    values: list[float], *, seed: int, replicates: int = 2000
) -> tuple[float, float] | None:
    """Return a 95% percentile CI by resampling students, not attempts."""
    if len(values) < 2:
        return None
    if replicates < 100:
        raise ValueError("Bootstrap replicates must be at least 100.")
    generator = random.Random(seed)
    estimates = sorted(
        fmean(generator.choice(values) for _ in values) for _ in range(replicates)
    )
    return estimates[int(0.025 * (replicates - 1))], estimates[int(0.975 * (replicates - 1))]


def build_metrics(
    snapshot: dict[str, Any],
    *,
    timezone_name: str,
    current_date: date,
    bootstrap_seed: int = 20261117,
    bootstrap_replicates: int = 2000,
) -> list[dict[str, Any]]:
    """Convert grouped database results into long-form rows without IDs."""
    students_by_arm_week: Counter[tuple[str, date]] = Counter()
    earliest_week: date | None = None
    for student in snapshot["students"]:
        week = week_start_for(student["created_at"], timezone_name)
        students_by_arm_week[(student["arm"], week)] += 1
        earliest_week = week if earliest_week is None else min(earliest_week, week)

    current_week = current_date - timedelta(days=current_date.weekday())
    weeks = list(iter_weeks(earliest_week, current_week))
    learner_week_totals: dict[tuple[str, date, str], list[int]] = defaultdict(lambda: [0, 0])
    confidence_counts: dict[tuple[str, date, int], list[int]] = defaultdict(lambda: [0, 0])
    attempts_by_arm_week: Counter[tuple[str, date]] = Counter()

    for group in snapshot["submission_groups"]:
        arm, week, user_id = group["arm"], group["week_start"], str(group["user_id"])
        confidence, attempts, correct = int(group["confidence"]), int(group["attempts"]), int(group["correct"])
        learner_total = learner_week_totals[(arm, week, user_id)]
        learner_total[0] += attempts
        learner_total[1] += correct
        confidence_total = confidence_counts[(arm, week, confidence)]
        confidence_total[0] += attempts
        confidence_total[1] += correct
        attempts_by_arm_week[(arm, week)] += attempts

    active_students: dict[tuple[str, date], set[str]] = defaultdict(set)
    for activity in snapshot["weekly_activity"]:
        active_students[(activity["arm"], activity["week_start"])].add(str(activity["user_id"]))

    rows: list[dict[str, Any]] = []
    generated_at = datetime.now(timezone.utc).isoformat()
    registered_to_date = Counter()
    for week in weeks:
        for arm in ARMS:
            registered_to_date[arm] += students_by_arm_week[(arm, week)]
            learner_accuracies = [
                correct / attempts
                for (sample_arm, sample_week, _user_id), (attempts, correct) in learner_week_totals.items()
                if sample_arm == arm and sample_week == week and attempts > 0
            ]
            if learner_accuracies:
                ci = bootstrap_mean_ci(
                    learner_accuracies,
                    seed=bootstrap_seed + len(rows),
                    replicates=bootstrap_replicates,
                )
                rows.append(metric_row(
                    generated_at,
                    metric="weekly_mean_student_accuracy",
                    week_start=week.isoformat(),
                    arm=arm,
                    value=fmean(learner_accuracies),
                    lower_95_ci=ci[0] if ci else None,
                    upper_95_ci=ci[1] if ci else None,
                    sample_size=len(learner_accuracies),
                    attempt_count=attempts_by_arm_week[(arm, week)],
                ))

            groups = [
                (confidence, count, correct)
                for (sample_arm, sample_week, confidence), (count, correct) in confidence_counts.items()
                if sample_arm == arm and sample_week == week
            ]
            calibration_attempts = sum(group[1] for group in groups)
            if calibration_attempts:
                rows.append(metric_row(
                    generated_at,
                    metric="weekly_ece",
                    week_start=week.isoformat(),
                    arm=arm,
                    value=expected_calibration_error_from_counts(groups),
                    sample_size=calibration_attempts,
                    attempt_count=calibration_attempts,
                ))

            registered = registered_to_date[arm]
            active = len(active_students[(arm, week)])
            rows.append(metric_row(
                generated_at,
                metric="weekly_active_student_rate",
                week_start=week.isoformat(),
                arm=arm,
                value=active / registered if registered else None,
                sample_size=registered,
                attempt_count=None,
            ))

    feedback_by_subject = {row["subject"]: row for row in snapshot["feedback"]}
    subject_names = set(snapshot["subjects"]) | set(feedback_by_subject)
    for subject in sorted(subject_names):
        stats = feedback_by_subject.get(subject, {"rated": 0, "helpful": 0})
        rated = int(stats["rated"])
        rows.append(metric_row(
            generated_at,
            metric="explanation_helpfulness_rate",
            subject=subject,
            value=int(stats["helpful"]) / rated if rated else None,
            sample_size=rated,
        ))

    coverage_by_subject = {row["subject"]: row for row in snapshot["misconceptions"]}
    empty_coverage = {
        "topics_with_completed_runs": 0,
        "discovered_clusters": 0,
        "labelled_clusters": 0,
        "clustered_doubts": 0,
        "labelled_doubts": 0,
        "doubts_processed": 0,
    }
    for subject in sorted(subject_names):
        stats = coverage_by_subject.get(subject, empty_coverage)
        processed = int(stats["doubts_processed"])
        for metric, value, sample_size in (
            ("discovered_clusters", int(stats["discovered_clusters"]), int(stats["topics_with_completed_runs"])),
            ("labelled_clusters", int(stats["labelled_clusters"]), int(stats["topics_with_completed_runs"])),
            ("clustered_doubt_volume_share", int(stats["clustered_doubts"]) / processed if processed else None, processed),
            ("labelled_doubt_volume_share", int(stats["labelled_doubts"]) / processed if processed else None, processed),
        ):
            rows.append(metric_row(
                generated_at,
                metric=metric,
                subject=subject,
                value=value,
                sample_size=sample_size,
            ))
    return rows


def iter_weeks(first: date | None, last: date):
    if first is None:
        return
    current = first
    while current <= last:
        yield current
        current += timedelta(days=7)


def metric_row(
    generated_at: str,
    *,
    metric: str,
    value: float | int | None,
    week_start: str = "",
    arm: str = "",
    subject: str = "",
    lower_95_ci: float | None = None,
    upper_95_ci: float | None = None,
    sample_size: int | None = None,
    attempt_count: int | None = None,
) -> dict[str, Any]:
    return {
        "dataset": "real_observed",
        "metric": metric,
        "week_start": week_start,
        "arm": arm,
        "subject": subject,
        "value": value,
        "lower_95_ci": lower_95_ci,
        "upper_95_ci": upper_95_ci,
        "sample_size": sample_size,
        "attempt_count": attempt_count,
        "generated_at": generated_at,
    }


def load_database_snapshot(database_url: str, timezone_name: str) -> dict[str, Any]:
    import psycopg
    from psycopg.rows import dict_row

    connection = psycopg.connect(database_url, autocommit=True, row_factory=dict_row)
    try:
        connection.execute("SET default_transaction_read_only = on")
        students = connection.execute(
            "SELECT id AS user_id, arm::text AS arm, created_at "
            "FROM users WHERE role = 'student'"
        ).fetchall()
        submission_groups = connection.execute(
            """
            SELECT u.arm::text AS arm, s.user_id,
                   date_trunc('week', s.created_at AT TIME ZONE %s)::date AS week_start,
                   s.confidence_raw::int AS confidence, COUNT(*)::int AS attempts,
                   COUNT(*) FILTER (WHERE s.is_correct)::int AS correct
            FROM submissions s JOIN users u ON u.id = s.user_id
            WHERE u.role = 'student'
            GROUP BY u.arm, s.user_id, week_start, s.confidence_raw
            ORDER BY week_start, arm, s.user_id, confidence
            """,
            (timezone_name,),
        ).fetchall()
        weekly_activity = connection.execute(
            """
            SELECT arm, user_id, week_start FROM (
              SELECT u.arm::text AS arm, u.id AS user_id,
                     date_trunc('week', s.created_at AT TIME ZONE %s)::date AS week_start
              FROM submissions s JOIN users u ON u.id = s.user_id WHERE u.role = 'student'
              UNION
              SELECT u.arm::text AS arm, u.id AS user_id,
                     date_trunc('week', d.created_at AT TIME ZONE %s)::date AS week_start
              FROM doubt_queries d JOIN users u ON u.id = d.user_id WHERE u.role = 'student'
            ) activity ORDER BY week_start, arm, user_id
            """,
            (timezone_name, timezone_name),
        ).fetchall()
        feedback = connection.execute(
            """
            SELECT COALESCE(subject.name, 'Unlinked doubt') AS subject,
                   COUNT(*)::int AS rated,
                   COUNT(*) FILTER (WHERE feedback.helpful)::int AS helpful
            FROM doubt_feedback feedback
            JOIN users reviewer ON reviewer.id = feedback.user_id AND reviewer.role = 'student'
            JOIN doubt_queries doubt ON doubt.id = feedback.doubt_id
            LEFT JOIN questions question ON question.id = doubt.question_id
            LEFT JOIN subjects subject ON subject.id = question.subject_id
            GROUP BY subject.name ORDER BY subject
            """
        ).fetchall()
        subjects = connection.execute("SELECT name FROM subjects ORDER BY name").fetchall()
        misconceptions = connection.execute(
            """
            WITH latest_runs AS (
              SELECT DISTINCT ON (topic_id) run_id, topic_id, subject_id,
                     doubts_processed, clusters_found
              FROM misconception_cluster_runs WHERE status = 'completed'
              ORDER BY topic_id, completed_at DESC NULLS LAST, started_at DESC, run_id DESC
            ), run_totals AS (
              SELECT subject_id, COUNT(*)::int AS topics_with_completed_runs,
                     COALESCE(SUM(doubts_processed), 0)::int AS doubts_processed,
                     COALESCE(SUM(clusters_found), 0)::int AS discovered_clusters
              FROM latest_runs GROUP BY subject_id
            ), cluster_totals AS (
              SELECT latest.subject_id,
                     COUNT(cluster.id) FILTER (WHERE cluster.label IS NOT NULL)::int AS labelled_clusters,
                     COALESCE(SUM(cluster.size), 0)::int AS clustered_doubts,
                     COALESCE(SUM(cluster.size) FILTER (WHERE cluster.label IS NOT NULL), 0)::int AS labelled_doubts
              FROM latest_runs latest
              LEFT JOIN misconception_clusters cluster
                ON cluster.run_id = latest.run_id AND cluster.topic_id = latest.topic_id
              GROUP BY latest.subject_id
            )
            SELECT subject.name AS subject,
                   COALESCE(run_totals.topics_with_completed_runs, 0)::int AS topics_with_completed_runs,
                   COALESCE(run_totals.discovered_clusters, 0)::int AS discovered_clusters,
                   COALESCE(cluster_totals.labelled_clusters, 0)::int AS labelled_clusters,
                   COALESCE(cluster_totals.clustered_doubts, 0)::int AS clustered_doubts,
                   COALESCE(cluster_totals.labelled_doubts, 0)::int AS labelled_doubts,
                   COALESCE(run_totals.doubts_processed, 0)::int AS doubts_processed
            FROM subjects subject
            LEFT JOIN run_totals ON run_totals.subject_id = subject.id
            LEFT JOIN cluster_totals ON cluster_totals.subject_id = subject.id
            ORDER BY subject.name
            """
        ).fetchall()
        return {
            "students": students,
            "submission_groups": submission_groups,
            "weekly_activity": weekly_activity,
            "feedback": feedback,
            "subjects": [row["name"] for row in subjects],
            "misconceptions": misconceptions,
        }
    finally:
        connection.close()


def write_csv(rows: list[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({
                **row,
                "value": format_value(row["value"]),
                "lower_95_ci": format_value(row["lower_95_ci"]),
                "upper_95_ci": format_value(row["upper_95_ci"]),
                "sample_size": "" if row["sample_size"] is None else row["sample_size"],
                "attempt_count": "" if row["attempt_count"] is None else row["attempt_count"],
            })


def format_value(value: float | int | None) -> str:
    if value is None:
        return ""
    return str(value) if isinstance(value, int) else f"{value:.6f}"
