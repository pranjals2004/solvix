import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gate_resolver/services/api_client.dart';

void main() {
  test('loads topic notes from the API and maps the response', () async {
    RequestOptions? receivedOptions;
    final dio = Dio(BaseOptions(baseUrl: 'http://solvix.test/api/v1'))
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            receivedOptions = options;
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'notes': [
                    {
                      'id': 'note-1',
                      'subjectId': 'subject-1',
                      'topicId': 'topic-1',
                      'title': 'Binary trees',
                      'content': 'A tree has a root node.',
                      'updatedAt': '2026-11-17T00:00:00.000Z',
                    },
                  ],
                },
              ),
            );
          },
        ),
      );

    final notes = await SolvixApi(dio).getNotes('topic-1');

    expect(receivedOptions?.path, '/notes');
    expect(receivedOptions?.queryParameters, {'topicId': 'topic-1'});
    expect(notes, hasLength(1));
    expect(notes.single.id, 'note-1');
    expect(notes.single.title, 'Binary trees');
    expect(notes.single.content, 'A tree has a root node.');
    dio.close();
  });
}
