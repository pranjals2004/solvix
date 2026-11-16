import unittest

from scripts.ece import CalibrationObservation, expected_calibration_error


class ExpectedCalibrationErrorTests(unittest.TestCase):
    def test_confidence_accuracy_gap_and_empty_input(self):
        observations = [
            CalibrationObservation(confidence=5, outcome=True),
            CalibrationObservation(confidence=5, outcome=False),
        ]
        self.assertAlmostEqual(expected_calibration_error(observations), 0.5)
        self.assertEqual(expected_calibration_error([]), 0.0)


if __name__ == "__main__":
    unittest.main()
