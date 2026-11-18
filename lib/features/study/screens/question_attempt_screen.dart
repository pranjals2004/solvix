import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/providers/api_providers.dart';
import 'package:gate_resolver/core/widgets/math_text.dart';
import 'package:gate_resolver/data/models/api_content.dart';
import 'package:gate_resolver/services/api_client.dart';

class QuestionAttemptScreen extends ConsumerStatefulWidget {
  const QuestionAttemptScreen({
    required this.question,
    required this.subjectName,
    this.questionQueue,
    this.queueIndex = 0,
    this.adaptiveTopicId,
    super.key,
  });

  final ApiQuestion question;
  final String subjectName;
  final List<ApiQuestion>? questionQueue;
  final int queueIndex;
  final String? adaptiveTopicId;

  @override
  ConsumerState<QuestionAttemptScreen> createState() =>
      _QuestionAttemptScreenState();
}

class _QuestionAttemptScreenState extends ConsumerState<QuestionAttemptScreen> {
  final Stopwatch _stopwatch = Stopwatch();
  final TextEditingController _textAnswer = TextEditingController();
  final Set<int> _selectedOptions = {};
  Timer? _clock;
  int? _confidence;
  int? _singleChoice;
  int _elapsedSeconds = 0;
  bool _submitting = false;
  bool _loadingNext = false;
  String? _error;
  SubmissionResult? _result;

  bool get _isMultipleChoice => widget.question.type == 'msq';
  bool get _isNumeric => widget.question.type == 'nat';
  bool get _isShortAnswer => widget.question.type == 'short';
  bool get _hasQueuedNext =>
      widget.questionQueue != null &&
      widget.queueIndex + 1 < widget.questionQueue!.length;
  bool get _canLoadAdaptiveNext => widget.adaptiveTopicId != null;

  String get _nextActionLabel => _hasQueuedNext || _canLoadAdaptiveNext
      ? 'Next question'
      : 'Finish practice';

  @override
  void initState() {
    super.initState();
    _stopwatch.start();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _result == null) {
        setState(() => _elapsedSeconds = _stopwatch.elapsed.inSeconds);
      }
    });
  }

  @override
  void dispose() {
    _clock?.cancel();
    _textAnswer.dispose();
    super.dispose();
  }

  String _letter(int index) => String.fromCharCode(65 + index);

  Object? get _answer {
    if (_isNumeric || _isShortAnswer) {
      return _textAnswer.text.trim().isEmpty ? null : _textAnswer.text.trim();
    }
    if (_isMultipleChoice) {
      if (_selectedOptions.isEmpty) return null;
      return _selectedOptions.map(_letter).toList()..sort();
    }
    return _singleChoice == null ? null : _letter(_singleChoice!);
  }

  Future<void> _submit() async {
    final answer = _answer;
    if (answer == null || _confidence == null) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(solvixApiProvider)
          .submit(
            questionId: widget.question.id,
            answer: answer,
            timeTakenSec: _stopwatch.elapsed.inSeconds,
            confidence: _confidence!,
          );
      if (mounted) setState(() => _result = result);
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorMessage(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _goToNextQuestion() async {
    final queue = widget.questionQueue;
    if (queue != null && widget.queueIndex + 1 < queue.length) {
      final nextIndex = widget.queueIndex + 1;
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => QuestionAttemptScreen(
            question: queue[nextIndex],
            subjectName: widget.subjectName,
            questionQueue: queue,
            queueIndex: nextIndex,
          ),
        ),
      );
      return;
    }

    final topicId = widget.adaptiveTopicId;
    if (topicId != null) {
      setState(() => _loadingNext = true);
      try {
        final next = await ref
            .read(solvixApiProvider)
            .getNextQuestion(topicId: topicId);
        if (!mounted) return;
        if (next.question == null) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('No next question is available right now.'),
            ),
          );
          return;
        }
        await Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => QuestionAttemptScreen(
              question: next.question!,
              subjectName: widget.subjectName,
              adaptiveTopicId: topicId,
            ),
          ),
        );
      } catch (error) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(apiErrorMessage(error))));
        }
      } finally {
        if (mounted) setState(() => _loadingNext = false);
      }
      return;
    }

    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final question = widget.question;
    final correctLabels = _answerLabels(_result?.correctAnswer);
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.subjectName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Semantics(
                label:
                    'Elapsed time ${_elapsedSeconds ~/ 60} minutes ${_elapsedSeconds % 60} seconds',
                child: Chip(
                  avatar: const Icon(Icons.timer_outlined, size: 16),
                  label: Text(
                    '${(_elapsedSeconds ~/ 60).toString().padLeft(2, '0')}:${(_elapsedSeconds % 60).toString().padLeft(2, '0')}',
                  ),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  _TypeBadge(
                    type: question.type == 'short'
                        ? 'SHORT ANSWER'
                        : question.type.toUpperCase(),
                  ),
                  if (question.isPyq) ...[
                    const SizedBox(width: 8),
                    _TypeBadge(type: 'GATE ${question.pyqYear}'),
                  ],
                ],
              ),
              const SizedBox(height: 18),
              Text(
                'Question',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: AppColors.primaryLight,
                ),
              ),
              const SizedBox(height: 8),
              MathText(
                question.statementLatex,
                style: theme.textTheme.titleMedium?.copyWith(height: 1.45),
              ),
              const SizedBox(height: 24),
              if (_isNumeric || _isShortAnswer)
                TextField(
                  controller: _textAnswer,
                  keyboardType: _isNumeric
                      ? const TextInputType.numberWithOptions(
                          decimal: true,
                          signed: true,
                        )
                      : TextInputType.text,
                  decoration: const InputDecoration(
                    labelText: 'Type your answer',
                    border: OutlineInputBorder(),
                    helperText: 'This question is graded as a short answer.',
                  ),
                  onChanged: (_) => setState(() {}),
                )
              else ...[
                Text(
                  _isMultipleChoice
                      ? 'Select all that apply'
                      : 'Choose one answer',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                if (question.options.isEmpty)
                  const Text(
                    'No answer options are available for this question.',
                  ),
                for (var index = 0; index < question.options.length; index++)
                  _OptionTile(
                    letter: _letter(index),
                    text: question.options[index],
                    selected: _isMultipleChoice
                        ? _selectedOptions.contains(index)
                        : _singleChoice == index,
                    multiple: _isMultipleChoice,
                    submitted: _result != null,
                    correctOption: correctLabels.contains(_letter(index)),
                    onTap: _result != null || _submitting
                        ? null
                        : () => setState(() {
                            if (_isMultipleChoice) {
                              if (!_selectedOptions.add(index)) {
                                _selectedOptions.remove(index);
                              }
                            } else {
                              _singleChoice = index;
                            }
                          }),
                  ),
              ],
              const SizedBox(height: 24),
              Text(
                'How confident are you?',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Choose from 1 (guessing) to 5 (very confident).',
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: [
                  for (var value = 1; value <= 5; value++)
                    Semantics(
                      label: 'Confidence $value out of 5',
                      selected: _confidence == value,
                      button: true,
                      child: ChoiceChip(
                        label: Text('$value'),
                        selected: _confidence == value,
                        onSelected: _result != null || _submitting
                            ? null
                            : (_) => setState(() => _confidence = value),
                      ),
                    ),
                ],
              ),
              if (_error != null) ...[
                const SizedBox(height: 14),
                Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
              ],
              const SizedBox(height: 18),
              if (_result == null)
                FilledButton.icon(
                  onPressed:
                      _answer != null && _confidence != null && !_submitting
                      ? _submit
                      : null,
                  icon: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.check_circle_outline),
                  label: Text(_submitting ? 'Submitting…' : 'Submit answer'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 15),
                  ),
                )
              else
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _ResultCard(
                      result: _result!,
                      confidence: _confidence!,
                      question: question,
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: _loadingNext ? null : _goToNextQuestion,
                      icon: _loadingNext
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(
                              _nextActionLabel == 'Finish practice'
                                  ? Icons.done
                                  : Icons.navigate_next,
                            ),
                      label: Text(
                        _loadingNext ? 'Loading next…' : _nextActionLabel,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.letter,
    required this.text,
    required this.selected,
    required this.multiple,
    required this.submitted,
    required this.correctOption,
    required this.onTap,
  });

  final String letter;
  final String text;
  final bool selected;
  final bool multiple;
  final bool submitted;
  final bool correctOption;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = submitted && correctOption
        ? AppColors.success
        : submitted && selected
        ? AppColors.error
        : selected
        ? AppColors.primaryLight
        : Theme.of(context).colorScheme.outlineVariant;
    final emphasized = selected || (submitted && correctOption);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          child: Row(
            children: [
              CircleAvatar(
                radius: 15,
                backgroundColor: emphasized ? color : color.withOpacity(0.15),
                foregroundColor: emphasized
                    ? Colors.white
                    : Theme.of(context).colorScheme.onSurface,
                child: submitted && correctOption
                    ? const Icon(Icons.check, size: 16)
                    : multiple && selected
                    ? const Icon(Icons.check, size: 16)
                    : Text(letter, style: const TextStyle(fontSize: 12)),
              ),
              const SizedBox(width: 12),
              Expanded(child: MathText(text)),
              if (submitted && correctOption)
                const Icon(
                  Icons.check_circle,
                  color: AppColors.success,
                  size: 19,
                )
              else if (submitted && selected)
                const Icon(Icons.cancel, color: AppColors.error, size: 19)
              else if (!multiple && selected)
                const Icon(
                  Icons.check_circle,
                  color: AppColors.primaryLight,
                  size: 19,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TypeBadge extends StatelessWidget {
  const _TypeBadge({required this.type});
  final String type;

  @override
  Widget build(BuildContext context) => Chip(
    label: Text(type.toUpperCase(), style: const TextStyle(fontSize: 11)),
    visualDensity: VisualDensity.compact,
  );
}

String _formatCorrectAnswer(Object? rawAnswer, ApiQuestion question) {
  var answer = rawAnswer;
  if (answer is Map) {
    answer = answer['selected'] ?? answer['answer'] ?? answer['value'];
  }
  if (answer is List) {
    return answer
        .map((item) => _formatCorrectAnswer(item, question))
        .join(', ');
  }
  final text = answer?.toString().trim() ?? '';
  final label = text.toUpperCase();
  if (label.length == 1) {
    final index = label.codeUnitAt(0) - 65;
    if (index >= 0 && index < question.options.length) {
      return '$label. ${question.options[index]}';
    }
  }
  return text;
}

Set<String> _answerLabels(Object? rawAnswer) {
  var answer = rawAnswer;
  if (answer is Map) {
    answer = answer['selected'] ?? answer['answer'] ?? answer['value'];
  }
  if (answer is String) return {answer.trim().toUpperCase()};
  if (answer is List) {
    return answer.map((item) => item.toString().trim().toUpperCase()).toSet();
  }
  return const {};
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({
    required this.result,
    required this.confidence,
    required this.question,
  });

  final SubmissionResult result;
  final int confidence;
  final ApiQuestion question;

  @override
  Widget build(BuildContext context) {
    final color = result.isCorrect ? AppColors.success : AppColors.error;
    return Card(
      color: color.withOpacity(0.08),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  result.isCorrect ? Icons.check_circle : Icons.info_outline,
                  color: color,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    result.isCorrect ? 'Correct' : 'Not quite',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: color,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Text(
                  'Attempt ${result.attemptNo}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
            const SizedBox(height: 6),
            if (result.correctAnswer != null)
              Text(
                'Correct answer: ${_formatCorrectAnswer(result.correctAnswer, question)}',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
              ),
            if (result.correctAnswer != null) const SizedBox(height: 6),
            Text(
              'Confidence recorded: $confidence / 5',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 6),
            Text(
              'Topic rating: ${result.skillRatingBefore.toStringAsFixed(0)} -> ${result.skillRatingAfter.toStringAsFixed(1)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.leaderboard_outlined, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    result.countedForRank
                        ? 'Counted toward this week’s leaderboard.'
                        : switch (result.rankExclusionReason) {
                            'too_fast' =>
                              'Correct, but attempts under 10 seconds do not count toward the leaderboard.',
                            'already_counted' =>
                              'This question was already counted for you this week.',
                            'incorrect' =>
                              'Incorrect attempts do not count toward the leaderboard.',
                            _ =>
                              'This attempt did not change your weekly leaderboard count.',
                          },
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Text(
              'Worked solution',
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            MathText(
              result.solutionLatex,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}
