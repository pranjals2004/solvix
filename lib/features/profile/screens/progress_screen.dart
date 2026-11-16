import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/core/utils/ece.dart';
import 'package:gate_resolver/data/models/api_content.dart';
import 'package:gate_resolver/services/api_client.dart';

class ProgressScreen extends ConsumerWidget {
  const ProgressScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = ref.watch(progressProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My progress')),
      body: progress.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(apiErrorMessage(error), textAlign: TextAlign.center),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => ref.invalidate(progressProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (data) => _ProgressContent(data: data),
      ),
    );
  }
}

class _ProgressContent extends ConsumerWidget {
  const _ProgressContent({required this.data});

  final ProgressData data;

  CalibrationResult _eceFor(String? topicId) {
    final observations = data.observations
        .where((item) => topicId == null || item.topicId == topicId)
        .map(
          (item) => CalibrationObservation(
            confidence: item.confidence,
            outcome: item.outcome,
          ),
        )
        .toList();
    return expectedCalibrationError(observations);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overall = _eceFor(null);
    final hints = ref.watch(misconceptionHintsProvider);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Confidence calibration',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  overall.count == 0
                      ? 'Not enough attempts yet'
                      : 'Expected Calibration Error: ${(overall.ece * 100).toStringAsFixed(1)}%',
                ),
                const SizedBox(height: 4),
                Text(
                  overall.count == 0
                      ? 'Submit questions with a confidence rating to build this view.'
                      : 'Based on ${overall.count} recent attempts. Lower values mean confidence is closer to observed accuracy.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        hints.when(
          loading: () => const SizedBox.shrink(),
          error: (_, _) => const SizedBox.shrink(),
          data: (items) => items.isEmpty
              ? const SizedBox.shrink()
              : Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Patterns from your recent doubts',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'You may be working through these ideas. Use them as gentle review prompts.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 10),
                        for (final hint in items)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Text('• ${hint.topicName}: ${hint.label}'),
                          ),
                      ],
                    ),
                  ),
                ),
        ),
        const SizedBox(height: 14),
        if (data.topics.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(20),
              child: Text(
                'Topic ratings will appear after your first attempt.',
              ),
            ),
          )
        else ...[
          Text('Topic ratings', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          for (final topic in data.topics)
            _TopicProgressCard(topic: topic, ece: _eceFor(topic.topicId)),
        ],
      ],
    );
  }
}

class _TopicProgressCard extends StatelessWidget {
  const _TopicProgressCard({required this.topic, required this.ece});

  final ProgressTopic topic;
  final CalibrationResult ece;

  @override
  Widget build(BuildContext context) {
    final accuracy = topic.attempts == 0 ? 0.0 : topic.correct / topic.attempts;
    return Card(
      child: ListTile(
        leading: const CircleAvatar(
          backgroundColor: Color(0xFFE8EAF6),
          child: Icon(Icons.insights_outlined, color: AppColors.primaryLight),
        ),
        title: Text(topic.topicName),
        subtitle: Text(
          '${topic.subjectName}  |  ${topic.attempts} attempts  |  ${(accuracy * 100).toStringAsFixed(0)}% accuracy\n'
          '${ece.count == 0 ? 'Calibration: not enough data' : 'ECE: ${(ece.ece * 100).toStringAsFixed(1)}%'}',
        ),
        isThreeLine: true,
        trailing: Text(
          topic.rating.toStringAsFixed(0),
          style: Theme.of(context).textTheme.titleMedium,
        ),
      ),
    );
  }
}
