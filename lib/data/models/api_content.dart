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
  });

  final bool isCorrect;
  final String solutionLatex;
  final int attemptNo;

  factory SubmissionResult.fromJson(Map<String, dynamic> json) =>
      SubmissionResult(
        isCorrect: json['isCorrect'] as bool,
        solutionLatex: json['solutionLatex'] as String,
        attemptNo: json['attemptNo'] as int,
      );
}
