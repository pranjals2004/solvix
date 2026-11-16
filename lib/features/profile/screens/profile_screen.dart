import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/core/providers/providers.dart';
import 'package:gate_resolver/data/models/auth_session.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({required this.session, super.key});

  final AuthSession session;

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
