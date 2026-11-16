import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/widgets/custom_widgets.dart';
import 'package:gate_resolver/core/widgets/math_text.dart';
import 'package:gate_resolver/core/providers/providers.dart';
import 'package:gate_resolver/data/models/question.dart';

class PyqScreen extends ConsumerStatefulWidget {
  final String subjectName;

  const PyqScreen({Key? key, required this.subjectName}) : super(key: key);

  @override
  ConsumerState<PyqScreen> createState() => _PyqScreenState();
}

class _PyqScreenState extends ConsumerState<PyqScreen> {
  List<Question> _questions = [];
  int _currentIndex = 0;
  int? _selectedOption;
  bool _isSubmitted = false;
  bool _isLoading = true;
  
  // Stats for the active practice set
  int _correctAnswers = 0;
  int _totalAnswered = 0;

  @override
  void initState() {
    super.initState();
    _loadQuestions();
  }

  void _loadQuestions() async {
    final qService = ref.read(questionServiceProvider);
    final list = await qService.getPYQs(subject: widget.subjectName);
    
    if (mounted) {
      if (list.isNotEmpty) {
        setState(() {
          _questions = list;
          _isLoading = false;
        });
      } else {
        // Fallback: load any questions from the database if none matches this subject
        final all = await qService.getPYQs();
        setState(() {
          _questions = all;
          _isLoading = false;
        });
      }
    }
  }

  void _submitAnswer() {
    if (_selectedOption == null || _questions.isEmpty) return;
    
    final currentQ = _questions[_currentIndex];
    final isCorrect = _selectedOption == currentQ.correctOptionIndex;

    setState(() {
      _isSubmitted = true;
      _totalAnswered += 1;
      if (isCorrect) _correctAnswers += 1;
    });

    // Update global student statistics
    final user = ref.read(currentUserProvider);
    final currentSolved = user.questionsSolved;
    final currentAccuracy = user.accuracyRate;
    final newSolved = currentSolved + 1;
    final newAccuracy = isCorrect 
        ? ((currentAccuracy * currentSolved) + 1) / newSolved
        : (currentAccuracy * currentSolved) / newSolved;

    ref.read(currentUserProvider.notifier).state = user.copyWith(
      questionsSolved: newSolved,
      accuracyRate: newAccuracy,
    );
  }

  void _nextQuestion() {
    if (_currentIndex < _questions.length - 1) {
      setState(() {
        _currentIndex += 1;
        _selectedOption = null;
        _isSubmitted = false;
      });
    } else {
      // Completed the set!
      showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: const Text('Practice Set Completed! 🎉'),
            content: Text(
              'You solved $_totalAnswered questions in this session.\n\n'
              'Correct Answers: $_correctAnswers\n'
              'Session Accuracy: ${_totalAnswered > 0 ? ((_correctAnswers / _totalAnswered) * 100).toStringAsFixed(0) : 0}%',
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context); // Pop dialog
                  Navigator.pop(context); // Pop PYQ screen back to Subject details
                },
                child: const Text('Finish'),
              ),
            ],
          );
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('GATE PYQ Simulator')),
        body: const LoadingState(title: 'Loading GATE questions...'),
      );
    }

    if (_questions.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('GATE PYQ Simulator')),
        body: const EmptyState(
          title: 'No Questions Found',
          subtitle: 'Check back later or select a different subject module.',
          icon: Icons.quiz_outlined,
        ),
      );
    }

    final currentQ = _questions[_currentIndex];

    return Scaffold(
      appBar: AppBar(
        title: Column(
          children: [
            const Text('GATE PYQ Simulator', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            Text('${widget.subjectName} • Question ${_currentIndex + 1}/${_questions.length}', style: theme.textTheme.bodySmall),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.bookmark_border_rounded),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Question saved to bookmarks!')),
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
            // Question info card
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'GATE ${currentQ.gateYear ?? "CSE"}',
                        style: const TextStyle(
                          color: AppColors.primaryLight,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      currentQ.topic,
                      style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
                DifficultyBadge(difficulty: currentQ.difficulty),
              ],
            ),
            const SizedBox(height: 16),

            // Question Text
            Text(
              'Question',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            AppCard(
              child: MathText(
                currentQ.questionText,
                style: theme.textTheme.bodyLarge?.copyWith(
                  height: 1.45,
                  fontFamily: 'serif',
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Options List
            Text(
              'Options',
              style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: currentQ.options.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, idx) {
                final optionText = currentQ.options[idx];
                final isSelected = _selectedOption == idx;
                final isCorrectOption = idx == currentQ.correctOptionIndex;

                Color optionBorderColor = Colors.transparent;
                Color optionBgColor = isDark ? AppColors.cardDark : Colors.white;

                if (isSelected && !_isSubmitted) {
                  optionBorderColor = AppColors.primaryLight;
                  optionBgColor = AppColors.primaryLight.withOpacity(0.05);
                } else if (_isSubmitted) {
                  if (isCorrectOption) {
                    optionBorderColor = AppColors.success;
                    optionBgColor = AppColors.success.withOpacity(0.08);
                  } else if (isSelected && !isCorrectOption) {
                    optionBorderColor = AppColors.error;
                    optionBgColor = AppColors.error.withOpacity(0.08);
                  }
                }

                return InkWell(
                  onTap: _isSubmitted
                      ? null
                      : () => setState(() => _selectedOption = idx),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: optionBgColor,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: optionBorderColor != Colors.transparent 
                            ? optionBorderColor 
                            : (isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.08)),
                        width: 1.5,
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            optionText,
                            style: TextStyle(
                              color: isDark ? Colors.white : AppColors.textPrimaryLight,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                        ),
                        if (_isSubmitted && isCorrectOption)
                          const Icon(Icons.check_circle, color: AppColors.success, size: 22)
                        else if (_isSubmitted && isSelected && !isCorrectOption)
                          const Icon(Icons.cancel, color: AppColors.error, size: 22)
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 24),

            // Submit / Next action
            if (!_isSubmitted)
              PrimaryButton(
                text: 'Submit Answer',
                onPressed: _selectedOption == null ? null : _submitAnswer,
              )
            else ...[
              // Explanation block
              AppCard(
                color: isDark ? Colors.white.withOpacity(0.02) : Colors.grey.shade50,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          _selectedOption == currentQ.correctOptionIndex
                              ? Icons.check_circle_outline
                              : Icons.error_outline,
                          color: _selectedOption == currentQ.correctOptionIndex
                              ? AppColors.success
                              : AppColors.error,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _selectedOption == currentQ.correctOptionIndex
                              ? 'Correct Solution!'
                              : 'Incorrect Answer.',
                          style: TextStyle(
                            color: _selectedOption == currentQ.correctOptionIndex
                                ? AppColors.success
                                : AppColors.error,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text('Concept Reference:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 4),
                    Text(currentQ.concept, style: theme.textTheme.bodyMedium),
                    const SizedBox(height: 12),
                    const Text('Step-by-Step Explanation:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 6),
                    MathText(currentQ.explanation),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              PrimaryButton(
                text: _currentIndex < _questions.length - 1 ? 'Next Question' : 'Finish Practice Set',
                icon: Icons.navigate_next,
                onPressed: _nextQuestion,
              ),
            ],
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }
}
