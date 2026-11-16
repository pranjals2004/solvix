"""Reusable confidence calibration metric for evaluation tooling."""

from collections.abc import Iterable
from dataclasses import dataclass


@dataclass(frozen=True)
class CalibrationObservation:
    confidence: int
    outcome: bool


def expected_calibration_error(
    observations: Iterable[CalibrationObservation], bin_count: int = 10
) -> float:
    """Return equal-width-bin ECE using confidence probability (raw - 1) / 4."""
    if not 1 <= bin_count <= 100:
        raise ValueError("bin_count must be between 1 and 100")

    bins: list[list[float]] = [[0.0, 0.0, 0.0] for _ in range(bin_count)]
    total = 0
    for observation in observations:
        if not 1 <= observation.confidence <= 5:
            raise ValueError("confidence must be an integer between 1 and 5")
        probability = (observation.confidence - 1) / 4
        index = min(bin_count - 1, int(probability * bin_count))
        bins[index][0] += 1
        bins[index][1] += probability
        bins[index][2] += int(observation.outcome)
        total += 1

    if total == 0:
        return 0.0
    return sum(
        count / total * abs(confidence_total / count - correct_total / count)
        for count, confidence_total, correct_total in bins
        if count
    )
