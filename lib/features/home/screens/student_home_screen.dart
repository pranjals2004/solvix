import 'package:flutter/material.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/data/models/auth_session.dart';

class StudentHomeScreen extends StatelessWidget {
  const StudentHomeScreen({
    required this.session,
    required this.onStudy,
    super.key,
  });

  final AuthSession session;
  final VoidCallback onStudy;

  @override
  Widget build(BuildContext context) {
    final firstName = session.name.trim().split(RegExp(r'\s+')).first;
    final theme = Theme.of(context);
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
            const SizedBox(height: 28),
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
                      'Browse topics, work through GATE-style questions, and review step-by-step solutions.',
                      style: theme.textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 18),
                    FilledButton.icon(
                      onPressed: onStudy,
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
                leading: const Icon(Icons.verified_user_outlined),
                title: const Text('Your account is ready'),
                subtitle: Text('Signed in as ${session.email}'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
