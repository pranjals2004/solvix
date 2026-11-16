import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/data/models/api_content.dart';
import 'package:gate_resolver/features/study/screens/question_attempt_screen.dart';
import 'package:gate_resolver/services/api_client.dart';

class _FakeSolvixApi extends SolvixApi {
  _FakeSolvixApi() : super(Dio());

  Object? submittedAnswer;
  int? submittedConfidence;

  @override
  Future<SubmissionResult> submit({
    required String questionId,
    required Object answer,
    required int timeTakenSec,
    required int confidence,
  }) async {
    submittedAnswer = answer;
    submittedConfidence = confidence;
    return const SubmissionResult(
      isCorrect: true,
      solutionLatex: r'\frac{1}{2} is the required value.',
      attemptNo: 1,
    );
  }
}

void main() {
  testWidgets('requires confidence and shows the solution after submission', (
    tester,
  ) async {
    final api = _FakeSolvixApi();
    const question = ApiQuestion(
      id: 'question-1',
      subjectId: 'subject-1',
      topicId: 'topic-1',
      type: 'mcq',
      statementLatex: r'What is the value of \(1/2\)?',
      options: ['One half', 'One third'],
      isPyq: false,
      pyqYear: null,
      difficultyRating: 1000,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [solvixApiProvider.overrideWithValue(api)],
        child: const MaterialApp(
          home: QuestionAttemptScreen(question: question, subjectName: 'DBMS'),
        ),
      ),
    );

    final submitButton = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Submit answer'),
    );
    expect(submitButton.onPressed, isNull);

    await tester.tap(find.text('One half'));
    await tester.pump();
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Submit answer'),
          )
          .onPressed,
      isNull,
    );
    final confidenceChip = find.widgetWithText(ChoiceChip, '4');
    await tester.tap(confidenceChip);
    await tester.pump();
    await tester.tap(find.widgetWithText(FilledButton, 'Submit answer'));
    await tester.pumpAndSettle();

    expect(api.submittedAnswer, 'A');
    expect(api.submittedConfidence, 4);
    expect(find.text('Correct'), findsOneWidget);
    expect(find.text('Worked solution'), findsOneWidget);
  });
}
