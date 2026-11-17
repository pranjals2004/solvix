import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/core/providers/providers.dart';
import 'package:gate_resolver/data/models/auth_session.dart';
import 'package:gate_resolver/features/profile/screens/progress_screen.dart';
import 'package:gate_resolver/services/api_client.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({required this.session, super.key});

  final AuthSession session;

  Future<void> _exportData(BuildContext context, WidgetRef ref) async {
    try {
      final export = await ref.read(authApiProvider).exportMyData();
      if (!context.mounted) return;
      final json = const JsonEncoder.withIndent('  ').convert(export);
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Your data export is ready'),
          content: const Text(
            'Solvix prepared your account data as JSON. Copy it to save a personal copy.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Close'),
            ),
            FilledButton.icon(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: json));
                if (dialogContext.mounted) Navigator.pop(dialogContext);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Account data copied to clipboard.'),
                    ),
                  );
                }
              },
              icon: const Icon(Icons.copy),
              label: const Text('Copy JSON'),
            ),
          ],
        ),
      );
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(apiErrorMessage(error))));
      }
    }
  }

  Future<void> _deleteAccount(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete your account?'),
        content: const Text(
          'This permanently removes your profile, learning history, doubts, peer posts, and uploaded images. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Keep account'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(dialogContext).colorScheme.error,
            ),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Delete account'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    try {
      await ref.read(authControllerProvider.notifier).deleteAccount();
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(apiErrorMessage(error))));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('My Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: AppColors.primaryLight.withOpacity(0.12),
                    child: Text(
                      session.name.trim().isEmpty
                          ? '?'
                          : session.name.trim()[0].toUpperCase(),
                      style: const TextStyle(
                        color: AppColors.primaryLight,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          session.name,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(session.email, style: theme.textTheme.bodyMedium),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(
                    Icons.download_outlined,
                    color: AppColors.primaryLight,
                  ),
                  title: const Text('Export my data'),
                  subtitle: const Text(
                    'Copy a JSON export of your account and learning activity.',
                  ),
                  onTap: () => _exportData(context, ref),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: Icon(
                    Icons.delete_outline,
                    color: theme.colorScheme.error,
                  ),
                  title: const Text('Delete my account'),
                  subtitle: const Text(
                    'Permanently erase your personal data and uploaded images.',
                  ),
                  onTap: () => _deleteAccount(context, ref),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              leading: const Icon(
                Icons.insights_outlined,
                color: AppColors.primaryLight,
              ),
              title: const Text('Progress and calibration'),
              subtitle: const Text(
                'Topic ratings, accuracy, and confidence calibration',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const ProgressScreen()),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: SwitchListTile(
              secondary: const Icon(
                Icons.dark_mode_outlined,
                color: AppColors.primaryLight,
              ),
              title: const Text('Dark mode'),
              value: themeMode == ThemeMode.dark,
              onChanged: (_) =>
                  ref.read(themeModeProvider.notifier).toggleTheme(),
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () async {
              try {
                await ref.read(authControllerProvider.notifier).logout();
              } catch (_) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Signed out on this device. Server sign-out could not be confirmed.',
                      ),
                    ),
                  );
                }
              }
            },
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}
