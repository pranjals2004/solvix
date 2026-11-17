import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/data/models/api_content.dart';
import 'package:gate_resolver/data/models/auth_session.dart';
import 'package:gate_resolver/services/api_client.dart';
import 'package:gate_resolver/services/doubt_api.dart';
import 'package:gate_resolver/services/leaderboard_api.dart';

final tokenStoreProvider = Provider<TokenStore>(
  (ref) => const SecureTokenStore(),
);

final dioProvider = Provider<Dio>((ref) {
  final store = ref.watch(tokenStoreProvider);
  final dio = Dio(
    BaseOptions(
      baseUrl: defaultApiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
      headers: {'content-type': 'application/json'},
    ),
  );
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await store.read();
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
    ),
  );
  ref.onDispose(() => dio.close(force: true));
  return dio;
});

final authApiProvider = Provider<AuthApi>(
  (ref) => AuthApi(ref.watch(dioProvider)),
);
final solvixApiProvider = Provider<SolvixApi>(
  (ref) => SolvixApi(ref.watch(dioProvider)),
);
final doubtApiProvider = Provider<DoubtApi>(
  (ref) => DoubtApi(ref.watch(dioProvider), ref.watch(tokenStoreProvider)),
);
final leaderboardApiProvider = Provider<LeaderboardApi>(
  (ref) => LeaderboardApi(ref.watch(dioProvider)),
);

class AuthController extends StateNotifier<AsyncValue<AuthSession?>> {
  AuthController(this._api, this._tokenStore) : super(const AsyncLoading()) {
    restoreSession();
  }

  final AuthApi _api;
  final TokenStore _tokenStore;

  Future<void> restoreSession() async {
    state = const AsyncLoading();
    try {
      final token = await _tokenStore.read();
      if (token == null) {
        state = const AsyncData(null);
        return;
      }
      state = AsyncData(await _api.me());
    } catch (error, stackTrace) {
      // Keep the token on transient network errors; an expired token is cleared.
      if (error is DioException && error.response?.statusCode == 401) {
        await _tokenStore.clear();
        state = const AsyncData(null);
      } else {
        state = AsyncError(error, stackTrace);
      }
    }
  }

  Future<void> login(String email, String password) async {
    final (token, session) = await _api.login(email.trim(), password);
    await _tokenStore.write(token);
    state = AsyncData(session);
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    required bool consent,
  }) async {
    final (token, session) = await _api.register(
      name: name.trim(),
      email: email.trim(),
      password: password,
      consent: consent,
    );
    await _tokenStore.write(token);
    state = AsyncData(session);
  }

  Future<void> logout() async {
    try {
      await _api.logout();
    } finally {
      await _tokenStore.clear();
      state = const AsyncData(null);
    }
  }

  Future<void> deleteAccount() async {
    await _api.deleteMyAccount();
    await _tokenStore.clear();
    state = const AsyncData(null);
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AsyncValue<AuthSession?>>((ref) {
      return AuthController(
        ref.watch(authApiProvider),
        ref.watch(tokenStoreProvider),
      );
    });

final subjectsProvider = FutureProvider<List<ApiSubject>>(
  (ref) => ref.watch(solvixApiProvider).getSubjects(),
);
final topicsProvider = FutureProvider.family<List<ApiTopic>, String>(
  (ref, subjectId) => ref.watch(solvixApiProvider).getTopics(subjectId),
);
final questionsProvider = FutureProvider.family<List<ApiQuestion>, String>(
  (ref, topicId) => ref.watch(solvixApiProvider).getQuestions(topicId: topicId),
);
final notesProvider = FutureProvider.family<List<ApiNote>, String>(
  (ref, topicId) => ref.watch(solvixApiProvider).getNotes(topicId),
);
final progressProvider = FutureProvider<ProgressData>(
  (ref) => ref.watch(solvixApiProvider).getProgress(),
);
final peerThreadsProvider = FutureProvider(
  (ref) => ref.watch(solvixApiProvider).getPeerThreads(),
);
final misconceptionHintsProvider = FutureProvider<List<MisconceptionHint>>(
  (ref) => ref.watch(solvixApiProvider).getMisconceptionHints(),
);
