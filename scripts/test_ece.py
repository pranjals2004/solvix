import unittest

from scripts.ece import (
    CalibrationObservation,
    expected_calibration_error,
    expected_calibration_error_from_counts,
)


class ExpectedCalibrationErrorTests(unittest.TestCase):
    def test_confidence_accuracy_gap_and_empty_input(self):
        observations = [
            CalibrationObservation(confidence=5, outcome=True),
            CalibrationObservation(confidence=5, outcome=False),
        ]
        self.assertAlmostEqual(expected_calibration_error(observations), 0.5)
        self.assertEqual(expected_calibration_error([]), 0.0)

    def test_aggregated_confidence_counts_match_observation_ece(self):
        observations = [
            CalibrationObservation(confidence=5, outcome=True),
            CalibrationObservation(confidence=5, outcome=False),
            CalibrationObservation(confidence=3, outcome=True),
        ]
        counts = [(5, 2, 1), (3, 1, 1)]
        self.assertAlmostEqual(
            expected_calibration_error_from_counts(counts),
            expected_calibration_error(observations),
        )

    def test_aggregated_confidence_counts_reject_invalid_counts(self):
        with self.assertRaises(ValueError):
            expected_calibration_error_from_counts([(3, 1, 2)])


if __name__ == "__main__":
    unittest.main()
