import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/data/models/leaderboard.dart';
import 'package:gate_resolver/services/api_client.dart';

class LeaderboardScreen extends ConsumerStatefulWidget {
  const LeaderboardScreen({this.userId, super.key});

  final String? userId;

  @override
  ConsumerState<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends ConsumerState<LeaderboardScreen> {
  late Future<WeeklyLeaderboardView> _leaderboard;

  @override
  void initState() {
    super.initState();
    _leaderboard = ref.read(leaderboardApiProvider).getWeekly();
  }

  Future<void> _refresh() async {
    final request = ref.read(leaderboardApiProvider).getWeekly();
    setState(() => _leaderboard = request);
    try {
      await request;
    } catch (_) {
      // FutureBuilder renders the request error state.
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Weekly leaderboard')),
      body: FutureBuilder<WeeklyLeaderboardView>(
        future: _leaderboard,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return _MessageState(
              icon: Icons.cloud_off_outlined,
              title: 'Leaderboard unavailable',
              message: apiErrorMessage(snapshot.error!),
              action: FilledButton.icon(
                onPressed: _refresh,
                icon: const Icon(Icons.refresh),
                label: const Text('Try again'),
              ),
            );
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final view = snapshot.data!;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'Week starting ${view.weekStart}',
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  'Ranked by distinct questions answered correctly. Speed does not improve rank.',
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: 16),
                Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      child: Text(
                        view.caller == null ? '—' : '#${view.caller!.rank}',
                      ),
                    ),
                    title: Text(
                      view.caller == null
                          ? 'Not ranked yet'
                          : 'Your weekly position',
                    ),
                    subtitle: Text(
                      '${view.caller?.solvedCount ?? 0} distinct questions solved',
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                if (view.entries.isEmpty)
                  const _MessageState(
                    icon: Icons.emoji_events_outlined,
                    title: 'No ranked questions yet',
                    message:
                        'Correct answers that meet the minimum attempt time appear here once per question each week.',
                  )
                else
                  ...view.entries.map(
                    (entry) => _LeaderboardRow(
                      entry: entry,
                      isCaller: entry.userId == widget.userId,
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _LeaderboardRow extends StatelessWidget {
  const _LeaderboardRow({required this.entry, required this.isCaller});

  final LeaderboardEntry entry;
  final bool isCaller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      color: isCaller
          ? theme.colorScheme.primaryContainer.withValues(alpha: 0.5)
          : null,
      child: ListTile(
        leading: CircleAvatar(child: Text('${entry.rank}')),
        title: Text(isCaller ? '${entry.name} (you)' : entry.name),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '${entry.solvedCount}',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            Text('solved', style: theme.textTheme.labelSmall),
          ],
        ),
      ),
    );
  }
}

class _MessageState extends StatelessWidget {
  const _MessageState({
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 40),
          const SizedBox(height: 12),
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center),
          if (action != null) ...[const SizedBox(height: 16), action!],
        ],
      ),
    ),
  );
}
