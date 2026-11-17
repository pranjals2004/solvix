import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/data/models/api_content.dart';
import 'package:gate_resolver/data/models/auth_session.dart';
import 'package:gate_resolver/features/study/screens/question_attempt_screen.dart';
import 'package:gate_resolver/features/community/screens/peer_doubt_board_screen.dart';
import 'package:gate_resolver/services/api_client.dart';

ProgressTopic? recommendedPracticeTopic(ProgressData progress) {
  final attemptedTopics =
      progress.topics.where((topic) => topic.attempts > 0).toList()
        ..sort((left, right) => left.rating.compareTo(right.rating));
  return attemptedTopics.isEmpty ? null : attemptedTopics.first;
}

class StudentHomeScreen extends ConsumerStatefulWidget {
  const StudentHomeScreen({
    required this.session,
    required this.onStudy,
    super.key,
  });

  final AuthSession session;
  final VoidCallback onStudy;

  @override
  ConsumerState<StudentHomeScreen> createState() => _StudentHomeScreenState();
}

class _StudentHomeScreenState extends ConsumerState<StudentHomeScreen> {
  bool _startingPractice = false;

  Future<void> _startPractice(ProgressTopic topic) async {
    setState(() => _startingPractice = true);
    try {
      final result = await ref
          .read(solvixApiProvider)
          .getNextQuestion(topicId: topic.topicId);
      if (!mounted) return;
      final question = result.question;
      if (question == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'No practice question is available for this topic yet. Try another topic in Study.',
            ),
          ),
        );
        return;
      }

      await Navigator.of(context).push<void>(
        MaterialPageRoute<void>(
          builder: (_) => QuestionAttemptScreen(
            question: question,
            subjectName: topic.subjectName,
          ),
        ),
      );
      if (mounted) ref.invalidate(progressProvider);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(apiErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _startingPractice = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final firstName = widget.session.name.trim().split(RegExp(r'\s+')).first;
    final theme = Theme.of(context);
    final progress = ref.watch(progressProvider);

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const SizedBox(height: 18),
            Text(
              'Welcome, $firstName',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Build your GATE CS & IT preparation one question at a time.',
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: 24),
            _ProgressCard(progress: progress),
            const SizedBox(height: 12),
            progress.when(
              loading: () => const Card(
                child: Padding(
                  padding: EdgeInsets.all(18),
                  child: Row(
                    children: [
                      SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      SizedBox(width: 12),
                      Text('Finding your next practice topic…'),
                    ],
                  ),
                ),
              ),
              error: (error, _) => Card(
                child: ListTile(
                  leading: const Icon(Icons.cloud_off_outlined),
                  title: const Text('Personalized practice is unavailable'),
                  subtitle: Text(apiErrorMessage(error)),
                  trailing: IconButton(
                    tooltip: 'Retry',
                    onPressed: () => ref.invalidate(progressProvider),
                    icon: const Icon(Icons.refresh),
                  ),
                ),
              ),
              data: (data) {
                final topic = recommendedPracticeTopic(data);
                if (topic == null) {
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.auto_awesome,
                            color: AppColors.primaryLight,
                            size: 30,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Your first adaptive practice',
                            style: theme.textTheme.titleLarge,
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Complete a question from the Study library and Solvix will use your results to personalize practice.',
                          ),
                          const SizedBox(height: 14),
                          FilledButton.icon(
                            onPressed: widget.onStudy,
                            icon: const Icon(Icons.menu_book_outlined),
                            label: const Text('Explore Study'),
                          ),
                        ],
                      ),
                    ),
                  );
                }
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.auto_awesome,
                          color: AppColors.primaryLight,
                          size: 30,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Recommended practice',
                          style: theme.textTheme.titleLarge,
                        ),
                        const SizedBox(height: 6),
                        Text('${topic.subjectName} · ${topic.topicName}'),
                        const SizedBox(height: 4),
                        Text(
                          'Your topic rating is ${topic.rating.toStringAsFixed(0)}. Solvix will choose a question and schedule review from your attempts.',
                          style: theme.textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 14),
                        FilledButton.icon(
                          onPressed: _startingPractice
                              ? null
                              : () => _startPractice(topic),
                          icon: _startingPractice
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.play_arrow),
                          label: Text(
                            _startingPractice
                                ? 'Choosing a question…'
                                : 'Start adaptive practice',
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.menu_book_outlined,
                      color: AppColors.primaryLight,
                      size: 30,
                    ),
                    const SizedBox(height: 14),
                    Text('Study by subject', style: theme.textTheme.titleLarge),
                    const SizedBox(height: 8),
                    Text(
                      'Browse topics, practice questions, and step-by-step solutions.',
                      style: theme.textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: widget.onStudy,
                      icon: const Icon(Icons.arrow_forward),
                      label: const Text('Open study library'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                leading: const Icon(Icons.forum_outlined),
                title: const Text('Peer doubt board'),
                subtitle: const Text(
                  'Discuss GATE CS & IT questions with other learners.',
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push<void>(
                  MaterialPageRoute<void>(
                    builder: (_) => const PeerDoubtBoardScreen(),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.progress});

  final AsyncValue<ProgressData> progress;

  @override
  Widget build(BuildContext context) => progress.when(
    loading: () => const SizedBox.shrink(),
    error: (_, _) => const SizedBox.shrink(),
    data: (data) {
      final attempts = data.topics.fold<int>(
        0,
        (total, topic) => total + topic.attempts,
      );
      final correct = data.topics.fold<int>(
        0,
        (total, topic) => total + topic.correct,
      );
      final accuracy = attempts == 0 ? null : correct / attempts;
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              const Icon(
                Icons.insights_outlined,
                color: AppColors.primaryLight,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your learning so far',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      accuracy == null
                          ? 'No submitted attempts yet'
                          : '$attempts attempts · ${(accuracy * 100).toStringAsFixed(0)}% correct',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
