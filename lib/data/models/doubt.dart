enum ChatMessageSender { student, ai }

class ChatMessage {
  final ChatMessageSender sender;
  final String text;
  final DateTime timestamp;
  final String? attachmentPath; // if any image or formula attached

  ChatMessage({
    required this.sender,
    required this.text,
    required this.timestamp,
    this.attachmentPath,
  });
}

class Doubt {
  final String id;
  final String questionText;
  final String subject;
  final String topic;
  final String? imageUrl;
  final String? studentNotes;
  final String askedByUserId;
  final DateTime createdAt;
  final bool isResolved;
  final bool isVerifiedSolution; // true if found in DB, false if AI generated
  final String? solutionMarkdown; // main solution content (may contain LaTeX)
  final List<String>? explanationSteps;
  final String? conceptSummary;
  final String? gateExamTip;
  final List<ChatMessage> chatHistory;

  Doubt({
    required this.id,
    required this.questionText,
    required this.subject,
    required this.topic,
    this.imageUrl,
    this.studentNotes,
    required this.askedByUserId,
    required this.createdAt,
    required this.isResolved,
    required this.isVerifiedSolution,
    this.solutionMarkdown,
    this.explanationSteps,
    this.conceptSummary,
    this.gateExamTip,
    required this.chatHistory,
  });

  Doubt copyWith({
    String? id,
    String? questionText,
    String? subject,
    String? topic,
    String? imageUrl,
    String? studentNotes,
    String? askedByUserId,
    DateTime? createdAt,
    bool? isResolved,
    bool? isVerifiedSolution,
    String? solutionMarkdown,
    List<String>? explanationSteps,
    String? conceptSummary,
    String? gateExamTip,
    List<ChatMessage>? chatHistory,
  }) {
    return Doubt(
      id: id ?? this.id,
      questionText: questionText ?? this.questionText,
      subject: subject ?? this.subject,
      topic: topic ?? this.topic,
      imageUrl: imageUrl ?? this.imageUrl,
      studentNotes: studentNotes ?? this.studentNotes,
      askedByUserId: askedByUserId ?? this.askedByUserId,
      createdAt: createdAt ?? this.createdAt,
      isResolved: isResolved ?? this.isResolved,
      isVerifiedSolution: isVerifiedSolution ?? this.isVerifiedSolution,
      solutionMarkdown: solutionMarkdown ?? this.solutionMarkdown,
      explanationSteps: explanationSteps ?? this.explanationSteps,
      conceptSummary: conceptSummary ?? this.conceptSummary,
      gateExamTip: gateExamTip ?? this.gateExamTip,
      chatHistory: chatHistory ?? this.chatHistory,
    );
  }
}
