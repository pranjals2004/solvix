import 'dart:math';

import 'package:dio/dio.dart';
import 'package:gate_resolver/data/models/doubt_session.dart';
import 'package:gate_resolver/services/api_client.dart';
import 'package:image_picker/image_picker.dart';

class DoubtApi {
  const DoubtApi(this._dio, this._tokens);

  final Dio _dio;
  final TokenStore _tokens;

  Future<DoubtSession> submit({required String text, XFile? image}) async {
    String? imageKey;
    if (image != null) {
      final bytes = await image.readAsBytes();
      final contentType = _imageContentType(image.name);
      final presign = await _dio.post<Map<String, dynamic>>(
        '/uploads/presign',
        data: {'contentType': contentType, 'contentLength': bytes.length},
      );
      final uploadUrl = presign.data!['uploadUrl'] as String;
      imageKey = presign.data!['imageKey'] as String;
      await Dio().put<void>(
        uploadUrl,
        data: bytes,
        options: Options(
          headers: {'content-type': contentType},
          contentType: contentType,
        ),
      );
    }

    final key = _requestId();
    final payload = <String, Object>{};
    if (text.trim().isNotEmpty) payload['text'] = text.trim();
    if (imageKey != null) payload['imageKey'] = imageKey;
    final response = await _dio.post<Map<String, dynamic>>(
      '/doubts',
      data: payload,
      options: Options(headers: {'Idempotency-Key': key}),
    );
    final doubtId = response.data!['doubtId'] as String;
    return fetch(doubtId);
  }

  Future<DoubtSession> fetch(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/doubts/$id');
    return DoubtSession.fromJson(response.data!);
  }

  Future<void> followUp(String id, String text) async {
    await _dio.post<void>(
      '/doubts/$id/messages',
      data: {'text': text, 'messageId': _requestId()},
    );
  }

  Future<void> feedback(String id, bool helpful) async {
    await _dio.post<void>('/doubts/$id/feedback', data: {'helpful': helpful});
  }

  Future<String?> accessToken() => _tokens.read();

  static String _imageContentType(String name) {
    final extension = name.toLowerCase().split('.').last;
    return switch (extension) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => 'image/jpeg',
    };
  }

  static String _requestId() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes
        .map((value) => value.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }
}
