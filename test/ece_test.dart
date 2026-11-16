import 'package:flutter_test/flutter_test.dart';
import 'package:gate_resolver/core/utils/ece.dart';

void main() {
  test('ECE compares self-reported confidence with observed outcomes', () {
    final result = expectedCalibrationError([
      const CalibrationObservation(confidence: 5, outcome: true),
      const CalibrationObservation(confidence: 5, outcome: false),
    ]);

    expect(result.count, 2);
    expect(result.ece, closeTo(0.5, 1e-9));
    expect(expectedCalibrationError(const []).count, 0);
  });
}
