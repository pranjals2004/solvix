import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gate_resolver/core/widgets/math_text.dart';

void main() {
  testWidgets('renders inline and display LaTeX with native math widgets', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: MathText(r'Inline \(x^2 + 1\), then display: $$\frac{1}{2}$$'),
        ),
      ),
    );

    expect(find.byType(Math), findsNWidgets(2));
    expect(find.textContaining(r'Inline '), findsOneWidget);
  });
}
