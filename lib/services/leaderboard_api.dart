import 'package:dio/dio.dart';
import 'package:gate_resolver/data/models/leaderboard.dart';

class LeaderboardApi {
  const LeaderboardApi(this._dio);

  final Dio _dio;

  Future<WeeklyLeaderboardView> getWeekly({int limit = 50}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/leaderboard/weekly',
      queryParameters: {'limit': limit},
    );
    return WeeklyLeaderboardView.fromJson(response.data!);
  }

  Future<WeeklyLeaderboardView> getArchive(
    String weekStart, {
    int limit = 50,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/leaderboard/archive',
      queryParameters: {'week': weekStart, 'limit': limit},
    );
    return WeeklyLeaderboardView.fromJson(response.data!);
  }
}
