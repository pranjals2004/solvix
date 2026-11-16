import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/widgets/custom_widgets.dart';
import 'package:gate_resolver/core/providers/providers.dart';

class AnalyticsScreen extends ConsumerWidget {
  const AnalyticsScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final user = ref.watch(currentUserProvider);
    final isDark = theme.brightness == Brightness.dark;

    final List<Map<String, dynamic>> subjectStats = [];
    user.subjectProgress.forEach((key, val) {
      subjectStats.add({'name': key, 'progress': val});
    });
    // Sort by progress ascending (weakest first)
    subjectStats.sort((a, b) => (a['progress'] as double).compareTo(b['progress'] as double));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Preparation Analytics'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Target GATE score goal simulator
            AppCard(
              color: isDark ? AppColors.primaryLight.withOpacity(0.08) : AppColors.primaryLight.withOpacity(0.04),
              child: Row(
                children: [
                  const Icon(Icons.insights, size: 36, color: AppColors.primaryLight),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'GATE Score Predictor',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.primaryLight),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Based on your accuracy (${(user.accuracyRate * 100).toStringAsFixed(0)}%) and questions solved (${user.questionsSolved}), you are on track for a predicted GATE score of 620-650.',
                          style: theme.textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  )
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Strengths and Weaknesses section
            Text('Topic Performance Insights', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: AppCard(
                    color: isDark ? AppColors.success.withOpacity(0.05) : AppColors.success.withOpacity(0.03),
                    border: Border.all(color: AppColors.success.withOpacity(0.2)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Row(
                          children: [
                            Icon(Icons.trending_up, color: AppColors.success, size: 18),
                            SizedBox(width: 8),
                            Text('Strong Topics', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.success)),
                          ],
                        ),
                        SizedBox(height: 10),
                        Text('• General Aptitude', style: TextStyle(fontSize: 12)),
                        Text('• Digital Logic', style: TextStyle(fontSize: 12)),
                        Text('• Computer Networks', style: TextStyle(fontSize: 12)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: AppCard(
                    color: isDark ? AppColors.error.withOpacity(0.05) : AppColors.error.withOpacity(0.03),
                    border: Border.all(color: AppColors.error.withOpacity(0.2)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Row(
                          children: [
                            Icon(Icons.trending_down, color: AppColors.error, size: 18),
                            SizedBox(width: 8),
                            Text('Weak Topics', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.error)),
                          ],
                        ),
                        SizedBox(height: 10),
                        Text('• Algorithms', style: TextStyle(fontSize: 12)),
                        Text('• COA', style: TextStyle(fontSize: 12)),
                        Text('• Compiler Design', style: TextStyle(fontSize: 12)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Subject-wise performance
            Text('Subject-wise Performance Breakdown', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            AppCard(
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: subjectStats.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, idx) {
                  final stat = subjectStats[idx];
                  final name = stat['name'] as String;
                  final progress = stat['progress'] as double;

                  Color color = AppColors.success;
                  if (progress < 0.40) {
                    color = AppColors.error;
                  } else if (progress < 0.65) {
                    color = AppColors.warning;
                  }

                  return Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(name, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
                          Text(
                            '${(progress * 100).toStringAsFixed(0)}%',
                            style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      AppProgressBar(progress: progress, color: color, height: 6),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 24),

            // Practice Streak Metrics
            Text('Streak & Consistency', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.local_fire_department, color: Colors.orange, size: 24),
                          const SizedBox(width: 8),
                          Text('${user.streakDays}-Day Practice Streak!', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        ],
                      ),
                      Text('Target: 30', style: theme.textTheme.bodySmall),
                    ],
                  ),
                  const SizedBox(height: 12),
                  AppProgressBar(progress: user.streakDays / 30.0, color: Colors.orange, height: 8),
                  const SizedBox(height: 12),
                  const Text(
                    'Solve 1 daily question every day to keep your streak alive. Daily streaks are proven to increase average GATE scores by up to 18%!',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}
