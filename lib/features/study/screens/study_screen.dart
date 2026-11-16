import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/core/widgets/math_text.dart';
import 'package:gate_resolver/data/models/api_content.dart';
import 'package:gate_resolver/features/study/screens/question_attempt_screen.dart';
import 'package:gate_resolver/services/api_client.dart';

class StudyScreen extends ConsumerWidget {
  const StudyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subjects = ref.watch(subjectsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Study')),
      body: subjects.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _LoadError(
          message: apiErrorMessage(error),
          onRetry: () => ref.invalidate(subjectsProvider),
        ),
        data: (items) => items.isEmpty
            ? const _EmptyContent(
                title: 'No subjects yet',
                message:
                    'Content will appear here after the course topics are added.',
                icon: Icons.menu_book_outlined,
              )
            : RefreshIndicator(
                onRefresh: () => ref.refresh(subjectsProvider.future),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  children: [
                    Text(
                      'GATE CS & IT',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: AppColors.primaryLight,
                        letterSpacing: 1.1,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Choose a subject to explore its topics and practice questions.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 18),
                    for (final subject in items) ...[
                      Card(
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                          leading: const CircleAvatar(
                            backgroundColor: Color(0xFFE8EAF6),
                            child: Icon(
                              Icons.school_outlined,
                              color: AppColors.primaryLight,
                            ),
                          ),
                          title: Text(
                            subject.name,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(subject.slug),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) =>
                                  SubjectTopicsScreen(subject: subject),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                    ],
                  ],
                ),
              ),
      ),
    );
  }
}

class SubjectTopicsScreen extends ConsumerWidget {
  const SubjectTopicsScreen({required this.subject, super.key});

  final ApiSubject subject;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final topics = ref.watch(topicsProvider(subject.id));
    return Scaffold(
      appBar: AppBar(title: Text(subject.name)),
      body: topics.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _LoadError(
          message: apiErrorMessage(error),
          onRetry: () => ref.invalidate(topicsProvider(subject.id)),
        ),
        data: (items) => items.isEmpty
            ? const _EmptyContent(
                title: 'No topics yet',
                message: 'Topics for this subject have not been added yet.',
                icon: Icons.topic_outlined,
              )
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final topic = items[index];
                  return Card(
                    child: ListTile(
                      leading: const Icon(
                        Icons.topic_outlined,
                        color: AppColors.primaryLight,
                      ),
                      title: Text(topic.name),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => TopicQuestionsScreen(
                            subject: subject,
                            topic: topic,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class TopicQuestionsScreen extends ConsumerWidget {
  const TopicQuestionsScreen({
    required this.subject,
    required this.topic,
    super.key,
  });

  final ApiSubject subject;
  final ApiTopic topic;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final questions = ref.watch(questionsProvider(topic.id));
    return Scaffold(
      appBar: AppBar(title: Text(topic.name)),
      body: questions.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _LoadError(
          message: apiErrorMessage(error),
          onRetry: () => ref.invalidate(questionsProvider(topic.id)),
        ),
        data: (items) => items.isEmpty
            ? const _EmptyContent(
                title: 'No questions yet',
                message:
                    'Ask an administrator to add questions for this topic.',
                icon: Icons.quiz_outlined,
              )
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final question = items[index];
                  return Card(
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      title: MathText(question.statementLatex),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          question.isPyq
                              ? 'GATE ${question.pyqYear} · ${question.type.toUpperCase()}'
                              : question.type.toUpperCase(),
                        ),
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => QuestionAttemptScreen(
                            question: question,
                            subjectName: subject.name,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class _LoadError extends StatelessWidget {
  const _LoadError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_outlined, size: 36),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    ),
  );
}

class _EmptyContent extends StatelessWidget {
  const _EmptyContent({
    required this.title,
    required this.message,
    required this.icon,
  });

  final String title;
  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 42, color: AppColors.primaryLight),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    ),
  );
}
