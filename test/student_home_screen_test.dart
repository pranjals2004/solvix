import 'package:flutter_test/flutter_test.dart';
import 'package:gate_resolver/data/models/api_content.dart';
import 'package:gate_resolver/features/home/screens/student_home_screen.dart';

void main() {
  test('recommends the attempted topic with the lowest rating', () {
    const progress = ProgressData(
      topics: [
        ProgressTopic(
          topicId: 'strong-topic',
          topicName: 'Algorithms',
          subjectId: 'cs',
          subjectName: 'Computer Science',
          rating: 1120,
          attempts: 5,
          correct: 4,
        ),
        ProgressTopic(
          topicId: 'new-topic',
          topicName: 'Networks',
          subjectId: 'cs',
          subjectName: 'Computer Science',
          rating: 800,
          attempts: 0,
          correct: 0,
        ),
        ProgressTopic(
          topicId: 'review-topic',
          topicName: 'Operating Systems',
          subjectId: 'cs',
          subjectName: 'Computer Science',
          rating: 930,
          attempts: 2,
          correct: 1,
        ),
      ],
      observations: [],
    );

    expect(recommendedPracticeTopic(progress)?.topicId, 'review-topic');
  });

  test('has no recommendation before the student submits an attempt', () {
    const progress = ProgressData(
      topics: [
        ProgressTopic(
          topicId: 'new-topic',
          topicName: 'Networks',
          subjectId: 'cs',
          subjectName: 'Computer Science',
          rating: 1000,
          attempts: 0,
          correct: 0,
        ),
      ],
      observations: [],
    );

    expect(recommendedPracticeTopic(progress), isNull);
  });
}
