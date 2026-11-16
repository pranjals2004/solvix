import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/data/models/leaderboard.dart';
import 'package:gate_resolver/features/leaderboard/screens/leaderboard_screen.dart';
import 'package:gate_resolver/services/leaderboard_api.dart';

class _FakeLeaderboardApi extends LeaderboardApi {
  _FakeLeaderboardApi(this.view) : super(Dio());

  final WeeklyLeaderboardView view;

  @override
  Future<WeeklyLeaderboardView> getWeekly({int limit = 50}) async => view;
}

void main() {
  testWidgets('shows weekly rank and distinct solved count', (tester) async {
    const view = WeeklyLeaderboardView(
      weekStart: '2026-11-16',
      entries: [
        LeaderboardEntry(
          userId: 'student-1',
          name: 'A Student',
          solvedCount: 3,
          rank: 1,
        ),
      ],
      caller: LeaderboardCaller(rank: 1, solvedCount: 3),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          leaderboardApiProvider.overrideWithValue(_FakeLeaderboardApi(view)),
        ],
        child: const MaterialApp(home: LeaderboardScreen(userId: 'student-1')),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Your weekly position'), findsOneWidget);
    expect(find.text('3 distinct questions solved'), findsOneWidget);
    expect(find.text('A Student (you)'), findsOneWidget);
    expect(find.text('Week starting 2026-11-16'), findsOneWidget);
  });

  testWidgets(
    'shows a calm empty state before the student has ranked questions',
    (tester) async {
      const view = WeeklyLeaderboardView(
        weekStart: '2026-11-16',
        entries: [],
        caller: null,
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            leaderboardApiProvider.overrideWithValue(_FakeLeaderboardApi(view)),
          ],
          child: const MaterialApp(
            home: LeaderboardScreen(userId: 'student-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Not ranked yet'), findsOneWidget);
      expect(find.text('No ranked questions yet'), findsOneWidget);
    },
  );
}
