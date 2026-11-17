import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/features/community/screens/peer_doubt_board_screen.dart';

void main() {
  testWidgets('shows a useful empty state and an entry point to ask', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [peerThreadsProvider.overrideWith((ref) async => [])],
        child: const MaterialApp(home: PeerDoubtBoardScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No questions yet'), findsOneWidget);
    expect(find.text('Start a discussion'), findsOneWidget);
    expect(find.text('Ask the community'), findsOneWidget);
  });
}
