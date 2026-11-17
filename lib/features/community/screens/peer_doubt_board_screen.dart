import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/data/models/peer_doubt.dart';
import 'package:gate_resolver/services/api_client.dart';

class PeerDoubtBoardScreen extends ConsumerWidget {
  const PeerDoubtBoardScreen({super.key});

  Future<void> _createThread(BuildContext context, WidgetRef ref) async {
    final result = await showDialog<_NewThread>(
      context: context,
      builder: (context) => const _NewThreadDialog(),
    );
    if (result == null || !context.mounted) return;
    try {
      final thread = await ref
          .read(solvixApiProvider)
          .createPeerThread(
            title: result.title,
            body: result.body,
            anonymous: result.anonymous,
          );
      ref.invalidate(peerThreadsProvider);
      if (context.mounted) {
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(
            builder: (_) => PeerThreadDetailScreen(threadId: thread.id),
          ),
        );
      }
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
    final threads = ref.watch(peerThreadsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Peer doubt board')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _createThread(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Ask the community'),
      ),
      body: threads.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _BoardMessage(
          icon: Icons.cloud_off_outlined,
          title: 'The board could not load',
          message: apiErrorMessage(error),
          action: TextButton.icon(
            onPressed: () => ref.invalidate(peerThreadsProvider),
            icon: const Icon(Icons.refresh),
            label: const Text('Try again'),
          ),
        ),
        data: (items) => items.isEmpty
            ? _BoardMessage(
                icon: Icons.forum_outlined,
                title: 'No questions yet',
                message:
                    'Ask a focused question and learn with other GATE CS & IT students.',
                action: OutlinedButton.icon(
                  onPressed: () => _createThread(context, ref),
                  icon: const Icon(Icons.add),
                  label: const Text('Start a discussion'),
                ),
              )
            : RefreshIndicator(
                onRefresh: () => ref.refresh(peerThreadsProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) => _ThreadCard(
                    thread: items[index],
                    onTap: () => Navigator.of(context).push<void>(
                      MaterialPageRoute<void>(
                        builder: (_) =>
                            PeerThreadDetailScreen(threadId: items[index].id),
                      ),
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}

class _ThreadCard extends StatelessWidget {
  const _ThreadCard({required this.thread, required this.onTap});

  final PeerThread thread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              thread.title,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(thread.body, maxLines: 3, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 6,
              children: [
                Text(
                  thread.authorName,
                  style: Theme.of(context).textTheme.labelMedium,
                ),
                if (thread.subjectName != null) Text(thread.subjectName!),
                Text(
                  '${thread.replyCount} ${thread.replyCount == 1 ? 'reply' : 'replies'}',
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

class PeerThreadDetailScreen extends ConsumerStatefulWidget {
  const PeerThreadDetailScreen({required this.threadId, super.key});

  final String threadId;

  @override
  ConsumerState<PeerThreadDetailScreen> createState() =>
      _PeerThreadDetailScreenState();
}

class _PeerThreadDetailScreenState
    extends ConsumerState<PeerThreadDetailScreen> {
  final _replyController = TextEditingController();
  AsyncValue<PeerThread> _thread = const AsyncLoading();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _replyController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _thread = const AsyncLoading());
    try {
      final thread = await ref
          .read(solvixApiProvider)
          .getPeerThread(widget.threadId);
      if (mounted) setState(() => _thread = AsyncData(thread));
    } catch (error, stackTrace) {
      if (mounted) setState(() => _thread = AsyncError(error, stackTrace));
    }
  }

  Future<void> _sendReply() async {
    final body = _replyController.text.trim();
    if (body.length < 2 || _sending) return;
    setState(() => _sending = true);
    try {
      final thread = await ref
          .read(solvixApiProvider)
          .replyToPeerThread(threadId: widget.threadId, body: body);
      _replyController.clear();
      if (mounted) setState(() => _thread = AsyncData(thread));
      ref.invalidate(peerThreadsProvider);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(apiErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Discussion')),
    body: _thread.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _BoardMessage(
        icon: Icons.cloud_off_outlined,
        title: 'Discussion unavailable',
        message: apiErrorMessage(error),
        action: TextButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh),
          label: const Text('Try again'),
        ),
      ),
      data: (thread) => Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  thread.title,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text('Asked by ${thread.authorName}'),
                if (thread.topicName != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    '${thread.subjectName ?? 'GATE CS & IT'} · ${thread.topicName}',
                  ),
                ],
                const SizedBox(height: 18),
                SelectableText(
                  thread.body,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 24),
                Text(
                  'Replies (${thread.replyCount})',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                if (thread.replies.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Text(
                        'No replies yet. Share a helpful explanation or ask a clarifying question.',
                      ),
                    ),
                  ),
                for (final reply in thread.replies)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            reply.authorName,
                            style: Theme.of(context).textTheme.labelLarge,
                          ),
                          const SizedBox(height: 8),
                          SelectableText(reply.body),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _replyController,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 2000,
                      decoration: const InputDecoration(
                        labelText: 'Write a reply',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    tooltip: 'Send reply',
                    onPressed: _sending ? null : _sendReply,
                    icon: _sending
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _NewThread {
  const _NewThread(this.title, this.body, this.anonymous);
  final String title;
  final String body;
  final bool anonymous;
}

class _NewThreadDialog extends StatefulWidget {
  const _NewThreadDialog();

  @override
  State<_NewThreadDialog> createState() => _NewThreadDialogState();
}

class _NewThreadDialogState extends State<_NewThreadDialog> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  bool _anonymous = false;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Ask the community'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _title,
            maxLength: 120,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Title',
              hintText: 'What are you stuck on?',
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _body,
            minLines: 4,
            maxLines: 7,
            maxLength: 3000,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Details',
              alignLabelWithHint: true,
            ),
          ),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Post anonymously'),
            value: _anonymous,
            onChanged: (value) => setState(() => _anonymous = value ?? false),
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed:
            _title.text.trim().length < 5 || _body.text.trim().length < 10
            ? null
            : () => Navigator.pop(
                context,
                _NewThread(_title.text.trim(), _body.text.trim(), _anonymous),
              ),
        child: const Text('Post'),
      ),
    ],
  );
}

class _BoardMessage extends StatelessWidget {
  const _BoardMessage({
    required this.icon,
    required this.title,
    required this.message,
    required this.action,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget action;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 40),
          const SizedBox(height: 12),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          action,
        ],
      ),
    ),
  );
}
