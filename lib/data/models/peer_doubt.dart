class PeerReply {
  const PeerReply({
    required this.id,
    required this.authorName,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String authorName;
  final String body;
  final DateTime createdAt;

  factory PeerReply.fromJson(Map<String, dynamic> json) => PeerReply(
    id: json['id'] as String,
    authorName: json['authorName'] as String,
    body: json['body'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
  );
}

class PeerThread {
  const PeerThread({
    required this.id,
    required this.authorName,
    required this.isAnonymous,
    required this.title,
    required this.body,
    required this.createdAt,
    required this.replyCount,
    required this.replies,
    this.subjectName,
    this.topicName,
  });

  final String id;
  final String authorName;
  final bool isAnonymous;
  final String title;
  final String body;
  final DateTime createdAt;
  final int replyCount;
  final List<PeerReply> replies;
  final String? subjectName;
  final String? topicName;

  factory PeerThread.fromJson(Map<String, dynamic> json) => PeerThread(
    id: json['id'] as String,
    authorName: json['authorName'] as String,
    isAnonymous: json['isAnonymous'] as bool,
    title: json['title'] as String,
    body: json['body'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    replyCount: (json['replyCount'] as num).toInt(),
    replies: (json['replies'] as List<dynamic>? ?? const [])
        .map((value) => PeerReply.fromJson(value as Map<String, dynamic>))
        .toList(),
    subjectName: json['subjectName'] as String?,
    topicName: json['topicName'] as String?,
  );
}
