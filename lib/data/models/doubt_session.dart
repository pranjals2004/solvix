class DoubtMessage {
  const DoubtMessage({
    required this.id,
    required this.role,
    required this.text,
    required this.createdAt,
  });

  final String id;
  final String role;
  final String text;
  final DateTime createdAt;

  factory DoubtMessage.fromJson(Map<String, dynamic> json) => DoubtMessage(
    id: json['id'] as String? ?? '',
    role: json['role'] as String? ?? 'user',
    text: json['text'] as String? ?? '',
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
  );
}

class DoubtSession {
  const DoubtSession({
    required this.id,
    required this.status,
    required this.conversation,
    this.text,
    this.imageKey,
    this.aiResponse,
    this.error,
  });

  final String id;
  final String status;
  final String? text;
  final String? imageKey;
  final List<DoubtMessage> conversation;
  final String? aiResponse;
  final String? error;

  factory DoubtSession.fromJson(Map<String, dynamic> json) => DoubtSession(
    id: json['id'] as String? ?? json['doubtId'] as String? ?? '',
    status: json['status'] as String? ?? 'pending',
    text: json['text'] as String?,
    imageKey: json['imageKey'] as String?,
    conversation: (json['conversation'] as List<dynamic>? ?? const [])
        .map((item) => DoubtMessage.fromJson(item as Map<String, dynamic>))
        .toList(),
    aiResponse: json['aiResponse'] as String?,
    error: json['error'] as String?,
  );
}
