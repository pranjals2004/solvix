class CalibrationObservation {
  const CalibrationObservation({
    required this.confidence,
    required this.outcome,
  });

  final int confidence;
  final bool outcome;
}

class CalibrationResult {
  const CalibrationResult({required this.ece, required this.count});

  final double ece;
  final int count;
}

/// Computes ECE using C=(confidence-1)/4 and equal-width probability bins.
CalibrationResult expectedCalibrationError(
  List<CalibrationObservation> observations, {
  int binCount = 10,
}) {
  if (binCount < 1 || binCount > 100) {
    throw ArgumentError.value(
      binCount,
      'binCount',
      'Must be between 1 and 100.',
    );
  }
  final counts = List<int>.filled(binCount, 0);
  final confidenceTotals = List<double>.filled(binCount, 0);
  final correctTotals = List<int>.filled(binCount, 0);
  for (final observation in observations) {
    if (observation.confidence < 1 || observation.confidence > 5) {
      throw ArgumentError.value(observation.confidence, 'confidence');
    }
    final probability = (observation.confidence - 1) / 4;
    final index = (probability * binCount).floor().clamp(0, binCount - 1);
    counts[index]++;
    confidenceTotals[index] += probability;
    if (observation.outcome) correctTotals[index]++;
  }
  if (observations.isEmpty) return const CalibrationResult(ece: 0, count: 0);
  var ece = 0.0;
  for (var index = 0; index < binCount; index++) {
    final count = counts[index];
    if (count == 0) continue;
    final meanConfidence = confidenceTotals[index] / count;
    final accuracy = correctTotals[index] / count;
    ece += count / observations.length * (meanConfidence - accuracy).abs();
  }
  return CalibrationResult(ece: ece, count: observations.length);
}
