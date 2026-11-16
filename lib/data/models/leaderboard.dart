class LeaderboardEntry {
  const LeaderboardEntry({
    required this.userId,
    required this.name,
    required this.solvedCount,
    required this.rank,
  });

  final String userId;
  final String name;
  final int solvedCount;
  final int rank;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) =>
      LeaderboardEntry(
        userId: json['userId'] as String,
        name: json['name'] as String,
        solvedCount: json['solvedCount'] as int,
        rank: json['rank'] as int,
      );
}

class LeaderboardCaller {
  const LeaderboardCaller({required this.rank, required this.solvedCount});

  final int rank;
  final int solvedCount;

  factory LeaderboardCaller.fromJson(Map<String, dynamic> json) =>
      LeaderboardCaller(
        rank: json['rank'] as int,
        solvedCount: json['solvedCount'] as int,
      );
}

class WeeklyLeaderboardView {
  const WeeklyLeaderboardView({
    required this.weekStart,
    required this.entries,
    required this.caller,
  });

  final String weekStart;
  final List<LeaderboardEntry> entries;
  final LeaderboardCaller? caller;

  factory WeeklyLeaderboardView.fromJson(Map<String, dynamic> json) =>
      WeeklyLeaderboardView(
        weekStart: json['weekStart'] as String,
        entries: (json['entries'] as List<dynamic>)
            .map(
              (entry) =>
                  LeaderboardEntry.fromJson(entry as Map<String, dynamic>),
            )
            .toList(),
        caller: json['caller'] == null
            ? null
            : LeaderboardCaller.fromJson(
                json['caller'] as Map<String, dynamic>,
              ),
      );
}
