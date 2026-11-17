import unittest
from datetime import date, datetime, timezone

from scripts.evaluation import bootstrap_mean_ci, build_metrics


class EvaluationMetricTests(unittest.TestCase):
    def setUp(self):
        week = date(2026, 11, 16)
        created_at = datetime(2026, 11, 16, 12, tzinfo=timezone.utc)
        self.week = week
        self.snapshot = {
            "students": [
                {"user_id": "student-a", "arm": "random", "created_at": created_at},
                {"user_id": "student-b", "arm": "random", "created_at": created_at},
                {"user_id": "student-c", "arm": "standard_elo", "created_at": created_at},
            ],
            "submission_groups": [
                {"arm": "random", "user_id": "student-a", "week_start": week,
                 "confidence": 5, "attempts": 1, "correct": 1},
                {"arm": "random", "user_id": "student-a", "week_start": week,
                 "confidence": 1, "attempts": 1, "correct": 0},
                {"arm": "random", "user_id": "student-b", "week_start": week,
                 "confidence": 3, "attempts": 1, "correct": 1},
            ],
            "weekly_activity": [
                {"arm": "random", "user_id": "student-a", "week_start": week},
                {"arm": "standard_elo", "user_id": "student-c", "week_start": week},
            ],
            "feedback": [{"subject": "Operating Systems", "rated": 2, "helpful": 1}],
            "subjects": ["DBMS", "Operating Systems"],
            "misconceptions": [{
                "subject": "Operating Systems",
                "topics_with_completed_runs": 2,
                "discovered_clusters": 3,
                "labelled_clusters": 2,
                "clustered_doubts": 10,
                "labelled_doubts": 6,
                "doubts_processed": 20,
            }],
        }

    def test_reports_weekly_accuracy_ece_engagement_and_subject_metrics(self):
        rows = build_metrics(
            self.snapshot,
            timezone_name="Asia/Kolkata",
            current_date=date(2026, 11, 17),
            bootstrap_seed=7,
            bootstrap_replicates=300,
        )
        accuracy = next(row for row in rows if row["metric"] == "weekly_mean_student_accuracy")
        ece = next(row for row in rows if row["metric"] == "weekly_ece")
        active = next(row for row in rows if row["metric"] == "weekly_active_student_rate" and row["arm"] == "random")
        helpfulness = next(row for row in rows if row["metric"] == "explanation_helpfulness_rate" and row["subject"] == "Operating Systems")
        coverage = next(row for row in rows if row["metric"] == "labelled_doubt_volume_share" and row["subject"] == "Operating Systems")

        self.assertEqual(accuracy["week_start"], "2026-11-16")
        self.assertAlmostEqual(accuracy["value"], 0.75)
        self.assertEqual(accuracy["sample_size"], 2)
        self.assertEqual(accuracy["attempt_count"], 3)
        self.assertLessEqual(accuracy["lower_95_ci"], accuracy["upper_95_ci"])
        self.assertAlmostEqual(ece["value"], 1 / 6)
        self.assertEqual(active["value"], 0.5)
        self.assertEqual(helpfulness["value"], 0.5)
        self.assertEqual(coverage["value"], 0.3)
        self.assertNotIn("student-a", str(rows))

    def test_empty_data_has_no_fabricated_accuracy_or_ece(self):
        empty_snapshot = {
            "students": [],
            "submission_groups": [],
            "weekly_activity": [],
            "feedback": [],
            "subjects": ["DBMS"],
            "misconceptions": [],
        }
        rows = build_metrics(
            empty_snapshot,
            timezone_name="Asia/Kolkata",
            current_date=date(2026, 11, 17),
        )
        self.assertNotIn("weekly_mean_student_accuracy", {row["metric"] for row in rows})
        self.assertNotIn("weekly_ece", {row["metric"] for row in rows})
        active = next(row for row in rows if row["metric"] == "explanation_helpfulness_rate")
        self.assertIsNone(active["value"])
        self.assertEqual(active["sample_size"], 0)

    def test_bootstrap_ci_requires_multiple_learners(self):
        self.assertIsNone(bootstrap_mean_ci([0.75], seed=1))
        self.assertEqual(bootstrap_mean_ci([0.5, 1.0], seed=4), bootstrap_mean_ci([0.5, 1.0], seed=4))


if __name__ == "__main__":
    unittest.main()
