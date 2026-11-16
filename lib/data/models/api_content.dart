class ApiSubject {
  const ApiSubject({required this.id, required this.name, required this.slug});

  final String id;
  final String name;
  final String slug;

  factory ApiSubject.fromJson(Map<String, dynamic> json) => ApiSubject(
    id: json['id'] as String,
    name: json['name'] as String,
    slug: json['slug'] as String,
  );
}

class ApiTopic {
  const ApiTopic({
    required this.id,
    required this.subjectId,
    required this.name,
    required this.slug,
  });

  final String id;
  final String subjectId;
  final String name;
  final String slug;

  factory ApiTopic.fromJson(Map<String, dynamic> json) => ApiTopic(
    id: json['id'] as String,
    subjectId: json['subjectId'] as String,
    name: json['name'] as String,
    slug: json['slug'] as String,
  );
}

class ApiQuestion {
  const ApiQuestion({
    required this.id,
    required this.subjectId,
    required this.topicId,
    required this.type,
    required this.statementLatex,
    required this.options,
    required this.isPyq,
    required this.pyqYear,
    required this.difficultyRating,
  });

  final String id;
  final String subjectId;
  final String topicId;
  final String type;
  final String statementLatex;
  final List<String> options;
  final bool isPyq;
  final int? pyqYear;
  final int difficultyRating;

  factory ApiQuestion.fromJson(Map<String, dynamic> json) => ApiQuestion(
    id: json['id'] as String,
    subjectId: json['subjectId'] as String,
    topicId: json['topicId'] as String,
    type: json['type'] as String,
    statementLatex: json['statementLatex'] as String,
    options: (json['optionsJson'] as List<dynamic>).cast<String>(),
    isPyq: json['isPyq'] as bool,
    pyqYear: json['pyqYear'] as int?,
    difficultyRating: json['difficultyRating'] as int,
  );
}

class SubmissionResult {
  const SubmissionResult({
    required this.isCorrect,
    required this.solutionLatex,
    required this.attemptNo,
    this.countedForRank = false,
    this.leaderboardWeekStart,
    this.rankExclusionReason,
    this.skillRatingBefore = 1000,
    this.skillRatingAfter = 1000,
    this.questionRatingBefore = 1000,
    this.questionRatingAfter = 1000,
  });

  final bool isCorrect;
  final String solutionLatex;
  final int attemptNo;
  final bool countedForRank;
  final String? leaderboardWeekStart;
  final String? rankExclusionReason;
  final double skillRatingBefore;
  final double skillRatingAfter;
  final double questionRatingBefore;
  final double questionRatingAfter;

  factory SubmissionResult.fromJson(
    Map<String, dynamic> json,
  ) => SubmissionResult(
    isCorrect: json['isCorrect'] as bool,
    solutionLatex: json['solutionLatex'] as String,
    attemptNo: json['attemptNo'] as int,
    countedForRank: json['countedForRank'] as bool? ?? false,
    leaderboardWeekStart: json['leaderboardWeekStart'] as String?,
    rankExclusionReason: json['rankExclusionReason'] as String?,
    skillRatingBefore: (json['skillRatingBefore'] as num?)?.toDouble() ?? 1000,
    skillRatingAfter: (json['skillRatingAfter'] as num?)?.toDouble() ?? 1000,
    questionRatingBefore:
        (json['questionRatingBefore'] as num?)?.toDouble() ?? 1000,
    questionRatingAfter:
        (json['questionRatingAfter'] as num?)?.toDouble() ?? 1000,
  );
}

class PracticeNextResult {
  const PracticeNextResult({
    required this.question,
    required this.isResurfaced,
    required this.selectionMode,
    required this.skillRating,
    this.reason,
  });

  final ApiQuestion? question;
  final bool isResurfaced;
  final String selectionMode;
  final double skillRating;
  final String? reason;

  factory PracticeNextResult.fromJson(Map<String, dynamic> json) {
    final value = json['question'];
    return PracticeNextResult(
      question: value is Map<String, dynamic>
          ? ApiQuestion.fromJson(value)
          : null,
      isResurfaced: json['isResurfaced'] as bool? ?? false,
      selectionMode: json['selectionMode'] as String? ?? 'adaptive',
      skillRating: (json['skillRating'] as num?)?.toDouble() ?? 1000,
      reason: json['reason'] as String?,
    );
  }
}

class ProgressTopic {
  const ProgressTopic({
    required this.topicId,
    required this.topicName,
    required this.subjectId,
    required this.subjectName,
    required this.rating,
    required this.attempts,
    required this.correct,
  });

  final String topicId;
  final String topicName;
  final String subjectId;
  final String subjectName;
  final double rating;
  final int attempts;
  final int correct;

  factory ProgressTopic.fromJson(Map<String, dynamic> json) => ProgressTopic(
    topicId: json['topicId'] as String,
    topicName: json['topicName'] as String,
    subjectId: json['subjectId'] as String,
    subjectName: json['subjectName'] as String,
    rating: (json['rating'] as num).toDouble(),
    attempts: json['attempts'] as int,
    correct: json['correct'] as int,
  );
}

class ProgressObservation {
  const ProgressObservation({
    required this.topicId,
    required this.confidence,
    required this.outcome,
  });

  final String topicId;
  final int confidence;
  final bool outcome;

  factory ProgressObservation.fromJson(Map<String, dynamic> json) =>
      ProgressObservation(
        topicId: json['topicId'] as String,
        confidence: json['confidence'] as int,
        outcome: json['outcome'] as bool,
      );
}

class ProgressData {
  const ProgressData({required this.topics, required this.observations});

  final List<ProgressTopic> topics;
  final List<ProgressObservation> observations;

  factory ProgressData.fromJson(Map<String, dynamic> json) => ProgressData(
    topics: (json['topics'] as List<dynamic>)
        .map((value) => ProgressTopic.fromJson(value as Map<String, dynamic>))
        .toList(),
    observations: (json['observations'] as List<dynamic>)
        .map(
          (value) =>
              ProgressObservation.fromJson(value as Map<String, dynamic>),
        )
        .toList(),
  );
}
