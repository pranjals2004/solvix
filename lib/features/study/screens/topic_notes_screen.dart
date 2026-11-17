import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/core/widgets/math_text.dart';
import 'package:gate_resolver/data/models/api_content.dart';
import 'package:gate_resolver/services/api_client.dart';

class TopicNotesScreen extends ConsumerWidget {
  const TopicNotesScreen({
    required this.topic,
    required this.subjectName,
    super.key,
  });

  final ApiTopic topic;
  final String subjectName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notes = ref.watch(notesProvider(topic.id));
    return Scaffold(
      appBar: AppBar(title: Text('${topic.name} notes')),
      body: notes.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _NotesMessage(
          icon: Icons.cloud_off_outlined,
          message: apiErrorMessage(error),
          action: OutlinedButton(
            onPressed: () => ref.invalidate(notesProvider(topic.id)),
            child: const Text('Retry'),
          ),
        ),
        data: (items) => items.isEmpty
            ? const _NotesMessage(
                icon: Icons.menu_book_outlined,
                message: 'There are no notes for this topic yet.',
              )
            : RefreshIndicator(
                onRefresh: () => ref.refresh(notesProvider(topic.id).future),
                child: ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final note = items[index];
                    return Card(
                      child: ListTile(
                        leading: const CircleAvatar(
                          child: Icon(Icons.article_outlined),
                        ),
                        title: Text(note.title),
                        subtitle: Text(
                          '${_readingMinutes(note.content)} min read',
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => NoteReaderScreen(
                              note: note,
                              subjectName: subjectName,
                              topicName: topic.name,
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }

  static int _readingMinutes(String content) {
    final words = content
        .trim()
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty)
        .length;
    return (words / 200).ceil().clamp(1, 999).toInt();
  }
}

class NoteReaderScreen extends StatelessWidget {
  const NoteReaderScreen({
    required this.note,
    required this.subjectName,
    required this.topicName,
    super.key,
  });

  final ApiNote note;
  final String subjectName;
  final String topicName;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(note.title, maxLines: 1, overflow: TextOverflow.ellipsis),
    ),
    body: SafeArea(
      child: SelectionArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            Text(
              '$subjectName  ·  $topicName',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const SizedBox(height: 20),
            MathText(
              note.content,
              style: Theme.of(
                context,
              ).textTheme.bodyLarge?.copyWith(height: 1.65),
            ),
          ],
        ),
      ),
    ),
  );
}

class _NotesMessage extends StatelessWidget {
  const _NotesMessage({required this.icon, required this.message, this.action});

  final IconData icon;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 40),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          if (action != null) ...[const SizedBox(height: 12), action!],
        ],
      ),
    ),
  );
}
