import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:gate_resolver/data/models/api_content.dart';
import 'package:gate_resolver/data/models/auth_session.dart';
import 'package:gate_resolver/data/models/peer_doubt.dart';

const accessTokenKey = 'solvix_access_token';
const defaultApiBaseUrl = String.fromEnvironment(
  'SOLVIX_API_URL',
  defaultValue: kIsWeb
      ? 'http://localhost:3000/api/v1'
      : 'http://10.0.2.2:3000/api/v1',
);

abstract interface class TokenStore {
  Future<String?> read();
  Future<void> write(String token);
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  const SecureTokenStore([this._storage = const FlutterSecureStorage()]);

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read() => _storage.read(key: accessTokenKey);

  @override
  Future<void> write(String token) =>
      _storage.write(key: accessTokenKey, value: token);

  @override
  Future<void> clear() => _storage.delete(key: accessTokenKey);
}

class AuthApi {
  const AuthApi(this._dio);

  final Dio _dio;

  Future<(String, AuthSession)> login(String email, String password) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'email': email, 'password': password},
    );
    final body = response.data!;
    return (
      body['token'] as String,
      AuthSession.fromJson(body['user'] as Map<String, dynamic>),
    );
  }

  Future<(String, AuthSession)> register({
    required String name,
    required String email,
    required String password,
    required bool consent,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/register',
      data: {
        'name': name,
        'email': email,
        'password': password,
        'consent': consent,
      },
    );
    final body = response.data!;
    return (
      body['token'] as String,
      AuthSession.fromJson(body['user'] as Map<String, dynamic>),
    );
  }

  Future<AuthSession> me() async {
    final response = await _dio.get<Map<String, dynamic>>('/auth/me');
    return AuthSession.fromJson(response.data!['user'] as Map<String, dynamic>);
  }

  Future<void> logout() async {
    await _dio.post<void>('/auth/logout');
  }

  Future<Map<String, dynamic>> exportMyData() async {
    final response = await _dio.get<Map<String, dynamic>>('/auth/me/export');
    return response.data!;
  }

  Future<void> deleteMyAccount() async {
    await _dio.delete<void>('/auth/me', data: {'confirmation': 'DELETE'});
  }
}

class SolvixApi {
  const SolvixApi(this._dio);

  final Dio _dio;

  Future<List<ApiSubject>> getSubjects() async {
    final response = await _dio.get<Map<String, dynamic>>('/subjects');
    return (response.data!['subjects'] as List<dynamic>)
        .map((value) => ApiSubject.fromJson(value as Map<String, dynamic>))
        .toList();
  }

  Future<List<ApiTopic>> getTopics(String subjectId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/subjects/$subjectId/topics',
    );
    return (response.data!['topics'] as List<dynamic>)
        .map((value) => ApiTopic.fromJson(value as Map<String, dynamic>))
        .toList();
  }

  Future<List<ApiQuestion>> getQuestions({
    String? subjectId,
    String? topicId,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/questions',
      queryParameters: {
        if (subjectId != null) 'subjectId': subjectId,
        if (topicId != null) 'topicId': topicId,
      },
    );
    return (response.data!['questions'] as List<dynamic>)
        .map((value) => ApiQuestion.fromJson(value as Map<String, dynamic>))
        .toList();
  }

  Future<List<ApiNote>> getNotes(String topicId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/notes',
      queryParameters: {'topicId': topicId},
    );
    return (response.data!['notes'] as List<dynamic>)
        .map((value) => ApiNote.fromJson(value as Map<String, dynamic>))
        .toList();
  }

  Future<SubmissionResult> submit({
    required String questionId,
    required Object answer,
    required int timeTakenSec,
    required int confidence,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/submissions',
      data: {
        'questionId': questionId,
        'answer': answer,
        'timeTakenSec': timeTakenSec,
        'confidence': confidence,
      },
    );
    return SubmissionResult.fromJson(
      response.data!['submission'] as Map<String, dynamic>,
    );
  }

  Future<PracticeNextResult> getNextQuestion({String? topicId}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/practice/next',
      queryParameters: {if (topicId != null) 'topicId': topicId},
    );
    return PracticeNextResult.fromJson(response.data!);
  }

  Future<ProgressData> getProgress() async {
    final response = await _dio.get<Map<String, dynamic>>('/progress');
    return ProgressData.fromJson(response.data!);
  }

  Future<List<MisconceptionHint>> getMisconceptionHints() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/misconceptions/hints',
    );
    return (response.data!['hints'] as List<dynamic>)
        .map(
          (value) => MisconceptionHint.fromJson(value as Map<String, dynamic>),
        )
        .toList();
  }

  Future<List<PeerThread>> getPeerThreads() async {
    final response = await _dio.get<Map<String, dynamic>>('/community/threads');
    return (response.data!['threads'] as List<dynamic>)
        .map((value) => PeerThread.fromJson(value as Map<String, dynamic>))
        .toList();
  }

  Future<PeerThread> getPeerThread(String threadId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/community/threads/$threadId',
    );
    return PeerThread.fromJson(
      response.data!['thread'] as Map<String, dynamic>,
    );
  }

  Future<PeerThread> createPeerThread({
    required String title,
    required String body,
    required bool anonymous,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/community/threads',
      data: {'title': title, 'body': body, 'anonymous': anonymous},
    );
    return PeerThread.fromJson(
      response.data!['thread'] as Map<String, dynamic>,
    );
  }

  Future<PeerThread> replyToPeerThread({
    required String threadId,
    required String body,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/community/threads/$threadId/replies',
      data: {'body': body},
    );
    return PeerThread.fromJson(
      response.data!['thread'] as Map<String, dynamic>,
    );
  }
}

String apiErrorMessage(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map &&
        data['error'] is Map &&
        (data['error'] as Map)['message'] is String) {
      return (data['error'] as Map)['message'] as String;
    }
    if (error.response == null) {
      return 'Could not reach Solvix. Check the API address and your connection.';
    }
  }
  return 'Something went wrong. Please try again.';
}
