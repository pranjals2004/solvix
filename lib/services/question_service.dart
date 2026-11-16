import 'package:gate_resolver/data/models/question.dart';
import 'package:gate_resolver/data/mock/mock_data.dart';

abstract class QuestionService {
  Future<List<Question>> searchQuestions(String query);
  Future<Question?> getQuestionById(String id);
  Future<Question> getDailyQuestion(int index); // support loading specific daily question
  Future<List<Question>> getPYQs({String? subject, String? topic, QuestionDifficulty? difficulty, int? year});
}

class MockQuestionService implements QuestionService {
  @override
  Future<List<Question>> searchQuestions(String query) async {
    await Future.delayed(const Duration(milliseconds: 400));
    if (query.isEmpty) return [];
    return MockData.questionsDatabase.where((q) {
      return q.questionText.toLowerCase().contains(query.toLowerCase()) ||
             q.subject.toLowerCase().contains(query.toLowerCase()) ||
             q.topic.toLowerCase().contains(query.toLowerCase());
    }).toList();
  }

  @override
  Future<Question?> getQuestionById(String id) async {
    await Future.delayed(const Duration(milliseconds: 200));
    try {
      return MockData.questionsDatabase.firstWhere((q) => q.id == id);
    } catch (_) {
      // Check in daily questions too
      try {
        return MockData.dailyQuestions.firstWhere((q) => q.id == id);
      } catch (_) {
        return null;
      }
    }
  }

  @override
  Future<Question> getDailyQuestion(int index) async {
    await Future.delayed(const Duration(milliseconds: 400));
    // Safe indexing for mock daily questions
    final safeIndex = index % MockData.dailyQuestions.length;
    return MockData.dailyQuestions[safeIndex];
  }

  @override
  Future<List<Question>> getPYQs({String? subject, String? topic, QuestionDifficulty? difficulty, int? year}) async {
    await Future.delayed(const Duration(milliseconds: 500));
    return MockData.questionsDatabase.where((q) {
      if (q.gateYear == null) return false;
      if (subject != null && q.subject != subject) return false;
      if (topic != null && q.topic != topic) return false;
      if (difficulty != null && q.difficulty != difficulty) return false;
      if (year != null && q.gateYear != year) return false;
      return true;
    }).toList();
  }
}
