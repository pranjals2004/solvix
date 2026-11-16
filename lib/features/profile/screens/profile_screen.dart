import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/widgets/custom_widgets.dart';
import 'package:gate_resolver/core/providers/providers.dart';
import 'package:gate_resolver/features/profile/screens/doubt_history_screen.dart';
import 'package:gate_resolver/features/profile/screens/analytics_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final user = ref.watch(currentUserProvider);
    final themeMode = ref.watch(themeModeProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Student Profile Header Card
            AppCard(
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundImage: user.avatarUrl.isEmpty ? null : NetworkImage(user.avatarUrl),
                    backgroundColor: AppColors.primaryLight.withOpacity(0.1),
                    child: user.avatarUrl.isEmpty
                        ? Text(user.name.trim().isEmpty ? '?' : user.name.trim()[0].toUpperCase())
                        : null,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user.name,
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'GATE CSE Aspirant',
                          style: TextStyle(
                            color: AppColors.primaryLight,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          user.bio,
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  )
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Profile Metrics Row
            Row(
              children: [
                Expanded(
                  child: AppCard(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(
                      children: [
                        Text('${user.questionsSolved}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                        const SizedBox(height: 2),
                        const Text('Solved', style: TextStyle(color: Colors.grey, fontSize: 11)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: AppCard(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(
                      children: [
                        Text('${user.doubtsAsked}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                        const SizedBox(height: 2),
                        const Text('Doubts', style: TextStyle(color: Colors.grey, fontSize: 11)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: AppCard(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(
                      children: [
                        Text('${(user.accuracyRate * 100).toStringAsFixed(0)}%', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                        const SizedBox(height: 2),
                        const Text('Demo accuracy', style: TextStyle(color: Colors.grey, fontSize: 11)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: AppCard(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(
                      children: [
                        Text('${user.streakDays}d', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.orange)),
                        const SizedBox(height: 2),
                        const Text('Streak', style: TextStyle(color: Colors.grey, fontSize: 11)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Profile Settings Navigation List
            AppCard(
              padding: EdgeInsets.zero,
              child: ListView(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  ListTile(
                    leading: const Icon(Icons.history_edu, color: AppColors.primaryLight),
                    title: const Text('My Doubts History'),
                    subtitle: const Text('View your asked doubts and solution methods'),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const DoubtHistoryScreen()),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.insights_outlined, color: AppColors.secondaryLight),
                    title: const Text('Study Progress & Analytics'),
                    subtitle: const Text('Review practice history and topic trends'),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const AnalyticsScreen()),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.bookmark_border_rounded, color: AppColors.accentCyan),
                    title: const Text('Saved Questions & Bookmarks'),
                    subtitle: const Text('Notes and questions you saved for review'),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Bookmarks library will be connected in future database version.')),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  
                  // Dark Mode Switch Row
                  SwitchListTile(
                    secondary: const Icon(Icons.dark_mode_outlined, color: Colors.indigo),
                    title: const Text('Dark Mode'),
                    subtitle: const Text('Enable low contrast night mode UI'),
                    activeColor: AppColors.primaryLight,
                    value: themeMode == ThemeMode.dark,
                    onChanged: (val) {
                      ref.read(themeModeProvider.notifier).toggleTheme();
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            
            // App Branding footer
            Text('GATE Resolver v1.0.0', style: theme.textTheme.bodySmall),
            Text('Ask. Understand. Prepare. Crack GATE.', style: theme.textTheme.bodySmall?.copyWith(fontSize: 10)),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
