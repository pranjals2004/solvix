import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/widgets/custom_widgets.dart';
import 'package:gate_resolver/core/widgets/math_text.dart';
import 'package:gate_resolver/data/models/doubt.dart';
import 'package:gate_resolver/features/doubt/screens/chat_screen.dart';
import 'package:gate_resolver/features/doubt/screens/post_community_screen.dart';

class SolutionScreen extends ConsumerWidget {
  final Doubt doubt;

  const SolutionScreen({Key? key, required this.doubt}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Solution Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Sharing solution link...')),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Verified or AI Generated Badge
            _buildSourceIndicator(context),
            const SizedBox(height: 16),

            // Subject and Topic Breadcrumb
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    doubt.subject,
                    style: const TextStyle(
                      color: AppColors.primaryLight,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  doubt.topic,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Question Section
            Text(
              'Question',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            AppCard(
              child: MathText(
                doubt.questionText,
                style: theme.textTheme.bodyLarge?.copyWith(
                  fontFamily: 'serif',
                  fontStyle: FontStyle.italic,
                  height: 1.4,
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Concept Section
            if (doubt.conceptSummary != null) ...[
              _buildSectionTitle(context, 'Core Concept'),
              const SizedBox(height: 8),
              AppCard(
                color: isDark ? Colors.blueGrey.withOpacity(0.1) : AppColors.primaryLight.withOpacity(0.03),
                border: Border.all(color: AppColors.primaryLight.withOpacity(0.15)),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.lightbulb_outline, color: AppColors.primaryLight, size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        doubt.conceptSummary!,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],

            // Step-by-Step Explanation
            if (doubt.explanationSteps != null && doubt.explanationSteps!.isNotEmpty) ...[
              _buildSectionTitle(context, 'Step-by-Step Explanation'),
              const SizedBox(height: 8),
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: doubt.explanationSteps!.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, idx) {
                  return AppCard(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 12,
                          backgroundColor: AppColors.primaryLight.withOpacity(0.1),
                          child: Text(
                            '${idx + 1}',
                            style: const TextStyle(
                              color: AppColors.primaryLight,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: MathText(doubt.explanationSteps![idx]),
                        ),
                      ],
                    ),
                  );
                },
              ),
              const SizedBox(height: 24),
            ],

            // Final Solution text
            if (doubt.solutionMarkdown != null) ...[
              _buildSectionTitle(context, 'Detailed Solution Summary'),
              const SizedBox(height: 8),
              AppCard(
                child: MathText(doubt.solutionMarkdown!),
              ),
              const SizedBox(height: 24),
            ],

            // GATE Exam Tip
            if (doubt.gateExamTip != null) ...[
              AppCard(
                color: isDark ? AppColors.warning.withOpacity(0.08) : AppColors.warning.withOpacity(0.04),
                border: Border.all(color: AppColors.warning.withOpacity(0.2)),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.bookmark_added_outlined, color: AppColors.warning),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'GATE Exam Tip',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: isDark ? AppColors.warning : AppColors.primaryDarkBlue,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(doubt.gateExamTip!),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 30),
            ],

            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: PrimaryButton(
                    text: 'Ask Follow-up',
                    icon: Icons.chat_bubble_outline_rounded,
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ChatScreen(doubt: doubt),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: SecondaryButton(
                    text: 'Post to Community',
                    icon: Icons.people_outline_rounded,
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => PostCommunityScreen(doubt: doubt),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: SecondaryButton(
                    text: 'Save Doubt',
                    icon: Icons.bookmark_border_rounded,
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Doubt successfully saved!')),
                      );
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(BuildContext context, String title) {
    return Text(
      title,
      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
    );
  }

  Widget _buildSourceIndicator(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (doubt.isVerifiedSolution) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.success.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.success.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            const Icon(Icons.verified, color: AppColors.success, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Verified GATE Solution',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColors.success,
                    ),
                  ),
                  Text(
                    'Matched with our verified CSE Knowledge Base.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                ],
              ),
            )
          ],
        ),
      );
    } else {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.secondaryLight.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.secondaryLight.withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.auto_awesome, color: AppColors.secondaryLight, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'AI Generated Solution',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColors.secondaryLight,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'No matching database solution was found. Gemini generated this response.',
              style: theme.textTheme.bodySmall?.copyWith(fontSize: 11),
            ),
            const SizedBox(height: 4),
            Text(
              '⚠️ AI-generated answer. Verify important concepts with official sources.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.warning,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      );
    }
  }
}
