import 'dart:async';
import 'dart:io' show File;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/data/models/doubt_session.dart';
import 'package:gate_resolver/core/widgets/math_text.dart';
import 'package:gate_resolver/services/api_client.dart';
import 'package:image_picker/image_picker.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

class DoubtScreen extends ConsumerStatefulWidget {
  const DoubtScreen({super.key});

  @override
  ConsumerState<DoubtScreen> createState() => _DoubtScreenState();
}

class _DoubtScreenState extends ConsumerState<DoubtScreen> {
  final _question = TextEditingController();
  final _followUp = TextEditingController();
  XFile? _image;
  DoubtSession? _doubt;
  Timer? _poller;
  io.Socket? _socket;
  bool _submitting = false;
  bool _sendingFollowUp = false;
  bool? _feedback;
  String? _error;

  @override
  void dispose() {
    _poller?.cancel();
    _socket?.dispose();
    _question.dispose();
    _followUp.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    final image = await ImagePicker().pickImage(
      source: source,
      imageQuality: 85,
    );
    if (image != null && mounted) setState(() => _image = image);
  }

  Future<void> _submit() async {
    if (_question.text.trim().isEmpty && _image == null) {
      setState(
        () => _error = 'Write a question or attach a photo of your work.',
      );
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _feedback = null;
    });
    try {
      final result = await ref
          .read(doubtApiProvider)
          .submit(text: _question.text, image: _image);
      if (!mounted) return;
      setState(() {
        _doubt = result;
        _question.clear();
        _image = null;
      });
      _watchDoubt(result.id);
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorMessage(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _watchDoubt(String id) async {
    _poller?.cancel();
    _poller = Timer.periodic(const Duration(seconds: 2), (_) => _refresh(id));
    try {
      final token = await ref.read(doubtApiProvider).accessToken();
      if (token == null || !mounted) return;
      final uri = Uri.parse(defaultApiBaseUrl);
      final origin = uri.replace(path: '', query: '', fragment: '').toString();
      final socket = io.io(origin, {
        'transports': ['websocket'],
        'auth': {'accessToken': token},
        'autoConnect': false,
      });
      _socket?.dispose();
      _socket = socket;
      socket.on('doubt:updated', (dynamic payload) {
        if (payload is Map && payload['doubtId'] == id) _refresh(id);
      });
      socket.connect();
    } catch (_) {
      // Polling remains available whenever the live socket cannot connect.
    }
  }

  Future<void> _refresh(String id) async {
    try {
      final result = await ref.read(doubtApiProvider).fetch(id);
      if (!mounted || _doubt?.id != id) return;
      setState(() => _doubt = result);
      if (result.status == 'done' || result.status == 'failed') {
        _poller?.cancel();
      }
    } catch (_) {
      // A short network interruption should not discard the current doubt.
    }
  }

  Future<void> _sendFollowUp() async {
    final doubt = _doubt;
    final text = _followUp.text.trim();
    if (doubt == null || text.isEmpty) return;
    setState(() {
      _sendingFollowUp = true;
      _error = null;
    });
    try {
      await ref.read(doubtApiProvider).followUp(doubt.id, text);
      _followUp.clear();
      await _refresh(doubt.id);
      _watchDoubt(doubt.id);
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorMessage(error));
    } finally {
      if (mounted) setState(() => _sendingFollowUp = false);
    }
  }

  Future<void> _sendFeedback(bool helpful) async {
    final doubt = _doubt;
    if (doubt == null) return;
    try {
      await ref.read(doubtApiProvider).feedback(doubt.id, helpful);
      if (mounted) setState(() => _feedback = helpful);
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorMessage(error));
    }
  }

  void _startNew() {
    _poller?.cancel();
    _socket?.dispose();
    setState(() {
      _doubt = null;
      _feedback = null;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final doubt = _doubt;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ask a GATE doubt'),
        actions: [
          if (doubt != null)
            IconButton(
              onPressed: _startNew,
              tooltip: 'New doubt',
              icon: const Icon(Icons.add),
            ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Get help grounded in Solvix notes and worked solutions.',
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _question,
              minLines: 3,
              maxLines: 7,
              decoration: const InputDecoration(
                labelText: 'What part is confusing?',
                hintText:
                    'Describe your approach or the step you want help with.',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: _submitting
                      ? null
                      : () => _pickImage(ImageSource.camera),
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: const Text('Take photo'),
                ),
                OutlinedButton.icon(
                  onPressed: _submitting
                      ? null
                      : () => _pickImage(ImageSource.gallery),
                  icon: const Icon(Icons.photo_outlined),
                  label: const Text('Choose image'),
                ),
              ],
            ),
            if (_image != null) ...[
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(
                  File(_image!.path),
                  height: 180,
                  fit: BoxFit.contain,
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _image!.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    onPressed: () => setState(() => _image = null),
                    tooltip: 'Remove image',
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.auto_awesome),
              label: Text(_submitting ? 'Sending…' : 'Ask Solvix'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
            ],
            if (doubt != null) ...[
              const SizedBox(height: 24),
              const Divider(),
              Row(
                children: [
                  Text('Your doubt', style: theme.textTheme.titleMedium),
                  const Spacer(),
                  _statusChip(doubt.status),
                ],
              ),
              const SizedBox(height: 12),
              for (final message in doubt.conversation)
                _messageCard(context, message),
              if (doubt.status == 'pending' || doubt.status == 'processing')
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(width: 12),
                        Expanded(child: Text('AI is thinking…')),
                      ],
                    ),
                  ),
                ),
              if (doubt.aiResponse != null) ...[
                Row(
                  children: [
                    const Text('Was this explanation helpful?'),
                    const Spacer(),
                    IconButton(
                      onPressed: () => _sendFeedback(true),
                      tooltip: 'Helpful',
                      color: _feedback == true
                          ? theme.colorScheme.primary
                          : null,
                      icon: const Icon(Icons.thumb_up_outlined),
                    ),
                    IconButton(
                      onPressed: () => _sendFeedback(false),
                      tooltip: 'Not helpful',
                      color: _feedback == false
                          ? theme.colorScheme.primary
                          : null,
                      icon: const Icon(Icons.thumb_down_outlined),
                    ),
                  ],
                ),
              ],
              if (doubt.status == 'failed')
                Text(
                  doubt.error ?? 'Solvix could not finish this explanation.',
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              if (doubt.status == 'done') ...[
                const SizedBox(height: 8),
                TextField(
                  controller: _followUp,
                  minLines: 1,
                  maxLines: 4,
                  decoration: InputDecoration(
                    labelText: 'Ask a follow-up',
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      onPressed: _sendingFollowUp ? null : _sendFollowUp,
                      icon: const Icon(Icons.send),
                    ),
                  ),
                  onSubmitted: (_) => _sendFollowUp(),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String status) {
    final color = switch (status) {
      'done' => Colors.green,
      'failed' => Colors.red,
      _ => Colors.blue,
    };
    return Chip(
      label: Text(status),
      visualDensity: VisualDensity.compact,
      side: BorderSide(color: color.withValues(alpha: 0.4)),
      labelStyle: TextStyle(color: color),
    );
  }

  Widget _messageCard(BuildContext context, DoubtMessage message) {
    final isStudent = message.role == 'user';
    if (!isStudent) {
      return Align(
        alignment: Alignment.centerLeft,
        child: Card(
          color: Theme.of(
            context,
          ).colorScheme.primaryContainer.withValues(alpha: 0.45),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.sizeOf(context).width * 0.86,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.auto_awesome, size: 17),
                      SizedBox(width: 6),
                      Text(
                        'AI-generated explanation',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SelectionArea(child: MathText(message.text)),
                ],
              ),
            ),
          ),
        ),
      );
    }
    return Align(
      alignment: isStudent ? Alignment.centerRight : Alignment.centerLeft,
      child: Card(
        color: isStudent
            ? Theme.of(context).colorScheme.secondaryContainer
            : null,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.sizeOf(context).width * 0.82,
            ),
            child: MathText(message.text),
          ),
        ),
      ),
    );
  }
}
