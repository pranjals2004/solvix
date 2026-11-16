import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/main.dart';
import 'package:gate_resolver/services/api_client.dart';

class _MemoryTokenStore implements TokenStore {
  @override
  Future<void> clear() async {}

  @override
  Future<String?> read() async => null;

  @override
  Future<void> write(String token) async {}
}

void main() {
  testWidgets('signed-out app opens the Solvix sign-in screen', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenStoreProvider.overrideWith((ref) => _MemoryTokenStore()),
        ],
        child: const GateResolverApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Welcome to Solvix'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('New to Solvix? Create an account'), findsOneWidget);
  });

  testWidgets('registration asks for consent before submitting', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenStoreProvider.overrideWith((ref) => _MemoryTokenStore()),
        ],
        child: const GateResolverApp(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('New to Solvix? Create an account'));
    await tester.pumpAndSettle();

    expect(find.text('Create your Solvix account'), findsOneWidget);
    expect(
      find.textContaining('I consent to use of my study activity'),
      findsOneWidget,
    );
    expect(find.text('Create account'), findsOneWidget);
  });
}
