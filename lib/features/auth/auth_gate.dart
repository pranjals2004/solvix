import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/features/auth/auth_screen.dart';
import 'package:gate_resolver/features/main_navigation_screen.dart';

class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    return authState.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (_, _) => Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_outlined, size: 40),
                const SizedBox(height: 12),
                const Text('Solvix could not restore your session.'),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => ref
                      .read(authControllerProvider.notifier)
                      .restoreSession(),
                  child: const Text('Try again'),
                ),
                TextButton(
                  onPressed: () => ref
                      .read(authControllerProvider.notifier)
                      .logout()
                      .catchError((Object _) {}),
                  child: const Text('Sign in again'),
                ),
              ],
            ),
          ),
        ),
      ),
      data: (session) => session == null
          ? const AuthScreen()
          : MainNavigationScreen(session: session),
    );
  }
}
