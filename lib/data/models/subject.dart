class NoteSection {
  final String id;
  final String title;
  final int readTimeMinutes;
  final String contentMarkdown;
  final double progress; // 0.0 to 1.0

  NoteSection({
    required this.id,
    required this.title,
    required this.readTimeMinutes,
    required this.contentMarkdown,
    required this.progress,
  });
}

class Topic {
  final String id;
  final String name;
  final bool isCompleted;
  final List<NoteSection> notes;

  Topic({
    required this.id,
    required this.name,
    required this.isCompleted,
    required this.notes,
  });
}

class Subject {
  final String id;
  final String name;
  final int questionsSolved;
  final double progress; // 0.0 to 1.0
  final List<Topic> topics;

  Subject({
    required this.id,
    required this.name,
    required this.questionsSolved,
    required this.progress,
    required this.topics,
  });

  int get totalTopics => topics.length;
}
