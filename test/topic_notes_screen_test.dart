import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/data/models/api_content.dart';
import 'package:gate_resolver/features/study/screens/topic_notes_screen.dart';
import 'package:gate_resolver/services/api_client.dart';

class _FakeSolvixApi extends SolvixApi {
  _FakeSolvixApi() : super(Dio());

  @override
  Future<List<ApiNote>> getNotes(String topicId) async => const [
    ApiNote(
      id: 'note-1',
      subjectId: 'subject-1',
      topicId: 'topic-1',
      title: 'Binary trees',
      content: 'A binary tree has at most two children per node.',
    ),
  ];
}

void main() {
  testWidgets('lists API notes and opens a readable note', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [solvixApiProvider.overrideWithValue(_FakeSolvixApi())],
        child: const MaterialApp(
          home: TopicNotesScreen(
            topic: ApiTopic(
              id: 'topic-1',
              subjectId: 'subject-1',
              name: 'Trees',
              slug: 'trees',
            ),
            subjectName: 'Data Structures',
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('Binary trees'), findsOneWidget);
    expect(find.text('1 min read'), findsOneWidget);

    await tester.tap(find.text('Binary trees'));
    await tester.pumpAndSettle();

    expect(find.text('Data Structures  ·  Trees'), findsOneWidget);
    expect(
      find.text('A binary tree has at most two children per node.'),
      findsOneWidget,
    );
  });

  testWidgets('shows a useful empty state when a topic has no notes', (
    tester,
  ) async {
    final api = _EmptyNotesApi();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [solvixApiProvider.overrideWithValue(api)],
        child: const MaterialApp(
          home: TopicNotesScreen(
            topic: ApiTopic(
              id: 'topic-1',
              subjectId: 'subject-1',
              name: 'Trees',
              slug: 'trees',
            ),
            subjectName: 'Data Structures',
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('There are no notes for this topic yet.'), findsOneWidget);
  });
}

class _EmptyNotesApi extends SolvixApi {
  _EmptyNotesApi() : super(Dio());

  @override
  Future<List<ApiNote>> getNotes(String topicId) async => const [];
}
