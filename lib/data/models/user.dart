class UserProfile {
  final String id;
  final String name;
  final String email;
  final String avatarUrl;
  final String bio;
  final int streakDays;
  final int questionsSolved;
  final int doubtsAsked;
  final double accuracyRate; // as a fraction, e.g. 0.76 for 76%
  final Map<String, double> subjectProgress; // e.g. {"Computer Networks": 0.72}

  UserProfile({
    required this.id,
    required this.name,
    required this.email,
    required this.avatarUrl,
    required this.bio,
    required this.streakDays,
    required this.questionsSolved,
    required this.doubtsAsked,
    required this.accuracyRate,
    required this.subjectProgress,
  });

  UserProfile copyWith({
    String? id,
    String? name,
    String? email,
    String? avatarUrl,
    String? bio,
    int? streakDays,
    int? questionsSolved,
    int? doubtsAsked,
    double? accuracyRate,
    Map<String, double>? subjectProgress,
  }) {
    return UserProfile(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      bio: bio ?? this.bio,
      streakDays: streakDays ?? this.streakDays,
      questionsSolved: questionsSolved ?? this.questionsSolved,
      doubtsAsked: doubtsAsked ?? this.doubtsAsked,
      accuracyRate: accuracyRate ?? this.accuracyRate,
      subjectProgress: subjectProgress ?? this.subjectProgress,
    );
  }
}
