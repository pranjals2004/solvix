import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(
      const ProviderScope(
        child: GateResolverApp(),
      ),
    );

    // Verify that the dashboard greeting exists
    expect(find.textContaining('Good Morning'), findsOneWidget);
  });
}
