class CommunityAnswer {
  final String id;
  final String answeredBy;
  final String avatarUrl;
  final DateTime answeredAt;
  final String answerMarkdown;
  final int upvotes;
  final bool isBestAnswer;
  final int commentsCount;

  CommunityAnswer({
    required this.id,
    required this.answeredBy,
    required this.avatarUrl,
    required this.answeredAt,
    required this.answerMarkdown,
    required this.upvotes,
    required this.isBestAnswer,
    required this.commentsCount,
  });

  CommunityAnswer copyWith({
    String? id,
    String? answeredBy,
    String? avatarUrl,
    DateTime? answeredAt,
    String? answerMarkdown,
    int? upvotes,
    bool? isBestAnswer,
    int? commentsCount,
  }) {
    return CommunityAnswer(
      id: id ?? this.id,
      answeredBy: answeredBy ?? this.answeredBy,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      answeredAt: answeredAt ?? this.answeredAt,
      answerMarkdown: answerMarkdown ?? this.answerMarkdown,
      upvotes: upvotes ?? this.upvotes,
      isBestAnswer: isBestAnswer ?? this.isBestAnswer,
      commentsCount: commentsCount ?? this.commentsCount,
    );
  }
}

class CommunityPost {
  final String id;
  final String questionText;
  final String subject;
  final String topic;
  final String askedBy;
  final String avatarUrl;
  final DateTime askedAt;
  final int upvotes;
  final bool isSolved;
  final String? description;
  final String? imageUrl;
  final List<CommunityAnswer> answers;

  CommunityPost({
    required this.id,
    required this.questionText,
    required this.subject,
    required this.topic,
    required this.askedBy,
    required this.avatarUrl,
    required this.askedAt,
    required this.upvotes,
    required this.isSolved,
    this.description,
    this.imageUrl,
    required this.answers,
  });

  int get answersCount => answers.length;

  CommunityPost copyWith({
    String? id,
    String? questionText,
    String? subject,
    String? topic,
    String? askedBy,
    String? avatarUrl,
    DateTime? askedAt,
    int? upvotes,
    bool? isSolved,
    String? description,
    String? imageUrl,
    List<CommunityAnswer>? answers,
  }) {
    return CommunityPost(
      id: id ?? this.id,
      questionText: questionText ?? this.questionText,
      subject: subject ?? this.subject,
      topic: topic ?? this.topic,
      askedBy: askedBy ?? this.askedBy,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      askedAt: askedAt ?? this.askedAt,
      upvotes: upvotes ?? this.upvotes,
      isSolved: isSolved ?? this.isSolved,
      description: description ?? this.description,
      imageUrl: imageUrl ?? this.imageUrl,
      answers: answers ?? this.answers,
    );
  }
}
