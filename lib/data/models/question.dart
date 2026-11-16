enum QuestionDifficulty { easy, medium, hard }

class Question {
  final String id;
  final String questionText;
  final String subject;
  final String topic;
  final QuestionDifficulty difficulty;
  final List<String> options;
  final int correctOptionIndex; // 0 for A, 1 for B, etc.
  final String explanation;
  final String concept;
  final int? gateYear; // null if not a PYQ
  final String? personalizationReason; // Reason why this question is recommended (e.g. weak topic)

  Question({
    required this.id,
    required this.questionText,
    required this.subject,
    required this.topic,
    required this.difficulty,
    required this.options,
    required this.correctOptionIndex,
    required this.explanation,
    required this.concept,
    this.gateYear,
    this.personalizationReason,
  });

  String get correctOptionLetter {
    switch (correctOptionIndex) {
      case 0: return 'A';
      case 1: return 'B';
      case 2: return 'C';
      case 3: return 'D';
      default: return '?';
    }
  }
}
