import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/widgets/custom_widgets.dart';
import 'package:gate_resolver/core/widgets/math_text.dart';
import 'package:gate_resolver/core/providers/providers.dart';
import 'package:gate_resolver/data/models/question.dart';
import 'package:gate_resolver/data/models/doubt.dart';
import 'package:gate_resolver/features/doubt/screens/solution_screen.dart';
import 'package:gate_resolver/data/models/user.dart';

// Home Dashboard Screen
class HomeScreen extends ConsumerStatefulWidget {
  final Function(int) onNavigateToTab;

  const HomeScreen({Key? key, required this.onNavigateToTab}) : super(key: key);

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  Question? _dailyQuestion;
  int? _selectedOption;
  bool _isAnswered = false;
  bool _isCorrect = false;
  bool _isLoadingQuestion = true;

  @override
  void initState() {
    super.initState();
    _loadDailyQuestion();
  }

  void _loadDailyQuestion() async {
    final questionService = ref.read(questionServiceProvider);
    // Fetch first daily question
    final q = await questionService.getDailyQuestion(0);
    if (mounted) {
      setState(() {
        _dailyQuestion = q;
        _isLoadingQuestion = false;
      });
    }
  }

  void _submitAnswer() {
    if (_selectedOption == null || _dailyQuestion == null) return;
    
    final correct = _selectedOption == _dailyQuestion!.correctOptionIndex;
    setState(() {
      _isAnswered = true;
      _isCorrect = correct;
    });

    // Update user stats
    final user = ref.read(currentUserProvider);
    final currentSolved = user.questionsSolved;
    final double currentAccuracy = user.accuracyRate;
    
    // Adjust accuracy and count
    final newSolved = currentSolved + 1;
    final double newAccuracy = correct 
        ? ((currentAccuracy * currentSolved) + 1) / newSolved
        : (currentAccuracy * currentSolved) / newSolved;

    ref.read(currentUserProvider.notifier).state = user.copyWith(
      questionsSolved: newSolved,
      accuracyRate: newAccuracy,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = ref.watch(currentUserProvider);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Good Morning, ${user.name.split(" ")[0]} 👋',
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Ready to improve your GATE score today?',
                        style: theme.textTheme.bodyMedium,
                      ),
                    ],
                  ),
                  InkWell(
                    onTap: () => widget.onNavigateToTab(4), // Navigate to Profile tab
                    borderRadius: BorderRadius.circular(20),
                    child: CircleAvatar(
                      radius: 20,
                      backgroundImage: NetworkImage(user.avatarUrl),
                      backgroundColor: AppColors.primaryLight.withOpacity(0.1),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Today's Question Card
              Text(
                'TODAY\'S QUESTION',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                  color: isDark ? AppColors.accentCyan : AppColors.primaryLight,
                ),
              ),
              const SizedBox(height: 8),
              _isLoadingQuestion
                  ? const AppCard(child: SizedBox(height: 120, child: LoadingState(title: 'Loading Daily Question...')))
                  : _buildDailyQuestionCard(theme, isDark),
              const SizedBox(height: 24),

              // Preparation Overview Metrics
              Text(
                'PREPARATION OVERVIEW',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                  color: isDark ? AppColors.accentCyan : AppColors.primaryLight,
                ),
              ),
              const SizedBox(height: 8),
              _buildMetricsGrid(user),
              const SizedBox(height: 24),

              // Your Weak Areas
              Text(
                'YOUR WEAK AREAS',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                  color: isDark ? AppColors.accentCyan : AppColors.primaryLight,
                ),
              ),
              const SizedBox(height: 8),
              _buildWeakAreasCard(user, isDark),
              const SizedBox(height: 24),

              // Recent Doubts
              Text(
                'RECENT DOUBTS',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                  color: isDark ? AppColors.accentCyan : AppColors.primaryLight,
                ),
              ),
              const SizedBox(height: 8),
              _buildRecentDoubts(isDark),
              const SizedBox(height: 24),

              // Quick Actions
              Text(
                'QUICK ACTIONS',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                  color: isDark ? AppColors.accentCyan : AppColors.primaryLight,
                ),
              ),
              const SizedBox(height: 8),
              _buildQuickActionsGrid(isDark),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  // Daily Question UI Block
  Widget _buildDailyQuestionCard(ThemeData theme, bool isDark) {
    if (_dailyQuestion == null) return const SizedBox.shrink();

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.star, color: Colors.amber, size: 18),
                  const SizedBox(width: 6),
                  Text(
                    _dailyQuestion!.subject,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ],
              ),
              DifficultyBadge(difficulty: _dailyQuestion!.difficulty),
            ],
          ),
          const SizedBox(height: 12),
          MathText(
            _dailyQuestion!.questionText,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w500,
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 16),
          
          // Options List
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _dailyQuestion!.options.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, idx) {
              final optionText = _dailyQuestion!.options[idx];
              final isSelected = _selectedOption == idx;
              final isCorrectOption = idx == _dailyQuestion!.correctOptionIndex;

              Color optionBorderColor = Colors.transparent;
              Color optionBgColor = isDark ? Colors.white.withOpacity(0.02) : Colors.grey.shade50;

              if (isSelected && !_isAnswered) {
                optionBorderColor = AppColors.primaryLight;
                optionBgColor = AppColors.primaryLight.withOpacity(0.05);
              } else if (_isAnswered) {
                if (isCorrectOption) {
                  optionBorderColor = AppColors.success;
                  optionBgColor = AppColors.success.withOpacity(0.08);
                } else if (isSelected && !isCorrectOption) {
                  optionBorderColor = AppColors.error;
                  optionBgColor = AppColors.error.withOpacity(0.08);
                }
              }

              return InkWell(
                onTap: _isAnswered
                    ? null
                    : () => setState(() => _selectedOption = idx),
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: optionBgColor,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: optionBorderColor != Colors.transparent 
                          ? optionBorderColor 
                          : (isDark ? Colors.white10 : Colors.black12),
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
                      if (_isAnswered && isCorrectOption)
                        const Icon(Icons.check_circle, color: AppColors.success, size: 20)
                      else if (_isAnswered && isSelected && !isCorrectOption)
                        const Icon(Icons.cancel, color: AppColors.error, size: 20)
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 16),

          // Attempt button or Feedback info
          if (!_isAnswered)
            PrimaryButton(
              text: 'Attempt Question',
              onPressed: _selectedOption == null ? null : _submitAnswer,
              height: 44,
            )
          else ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withOpacity(0.03) : Colors.grey.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: isDark ? Colors.white10 : Colors.black.withOpacity(0.05)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        _isCorrect ? Icons.check_circle_outline : Icons.error_outline,
                        color: _isCorrect ? AppColors.success : AppColors.error,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _isCorrect ? 'Correct Answer!' : 'Incorrect. Try reviewing notes.',
                        style: TextStyle(
                          color: _isCorrect ? AppColors.success : AppColors.error,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  if (_dailyQuestion!.personalizationReason != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _dailyQuestion!.personalizationReason!,
                      style: theme.textTheme.bodySmall?.copyWith(fontStyle: FontStyle.italic),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Text('Explanation:', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  MathText(_dailyQuestion!.explanation),
                ],
              ),
            ),
            const SizedBox(height: 12),
            SecondaryButton(
              text: 'Practice More daily challenges',
              icon: Icons.navigate_next,
              height: 40,
              onPressed: () {
                widget.onNavigateToTab(2); // Go to Study tab
              },
            ),
          ],
        ],
      ),
    );
  }

  // Metrics Grid
  Widget _buildMetricsGrid(UserProfile user) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 2.1,
      children: [
        _buildStatCard('Questions Solved', '${user.questionsSolved}', Icons.assignment_outlined, AppColors.primaryLight),
        _buildStatCard('Doubts Asked', '${user.doubtsAsked}', Icons.question_answer_outlined, AppColors.secondaryLight),
        _buildStatCard('Daily Streak', '${user.streakDays} days', Icons.local_fire_department, Colors.orange),
        _buildStatCard('Accuracy Rate', '${(user.accuracyRate * 100).toStringAsFixed(0)}%', Icons.track_changes_outlined, AppColors.success),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  value,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                Text(
                  label,
                  style: const TextStyle(color: Colors.grey, fontSize: 11),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          )
        ],
      ),
    );
  }

  // Weak Areas Progress List
  Widget _buildWeakAreasCard(UserProfile user, bool isDark) {
    final List<Map<String, dynamic>> weakTopics = [
      {'name': 'Algorithms', 'val': 0.48},
      {'name': 'Operating Systems', 'val': 0.54},
      {'name': 'DBMS', 'val': 0.61},
      {'name': 'Computer Networks', 'val': 0.72},
    ];

    return AppCard(
      child: Column(
        children: weakTopics.map((topic) {
          final progress = topic['val'] as double;
          Color barColor = AppColors.success;
          if (progress < 0.50) {
            barColor = AppColors.error;
          } else if (progress < 0.65) {
            barColor = AppColors.warning;
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: 12.0),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      topic['name'],
                      style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                    ),
                    Text(
                      '${(progress * 100).toStringAsFixed(0)}%',
                      style: TextStyle(color: barColor, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                AppProgressBar(progress: progress, color: barColor),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  // Recent doubts cards
  Widget _buildRecentDoubts(bool isDark) {
    final doubtService = ref.read(doubtServiceProvider);
    
    return FutureBuilder<List<Doubt>>(
      future: doubtService.getDoubtHistory(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const SizedBox(height: 100, child: Center(child: CircularProgressIndicator()));
        }
        
        final doubts = snapshot.data!.take(3).toList();
        if (doubts.isEmpty) {
          return const Text('No recent doubts.');
        }

        return ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: doubts.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, idx) {
            final doubt = doubts[idx];
            return AppCard(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => SolutionScreen(doubt: doubt)),
                );
              },
              child: Row(
                children: [
                  Container(
                    height: 40,
                    width: 40,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.help_center_outlined, color: AppColors.primaryLight, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          doubt.questionText,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        Row(
                          children: [
                            Text(doubt.subject, style: const TextStyle(color: Colors.grey, fontSize: 11)),
                            const SizedBox(width: 8),
                            const Text('•', style: TextStyle(color: Colors.grey, fontSize: 11)),
                            const SizedBox(width: 8),
                            Text(_timeAgo(doubt.createdAt), style: const TextStyle(color: Colors.grey, fontSize: 11)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // Quick Action Buttons
  Widget _buildQuickActionsGrid(bool isDark) {
    final List<Map<String, dynamic>> actions = [
      {'label': 'Ask a Doubt', 'icon': Icons.help_outline, 'tab': 1, 'color': AppColors.primaryLight},
      {'label': 'Study Notes', 'icon': Icons.menu_book, 'tab': 2, 'color': AppColors.secondaryLight},
      {'label': 'Practice PYQs', 'icon': Icons.quiz_outlined, 'tab': 2, 'color': AppColors.accentCyan},
      {'label': 'Community Board', 'icon': Icons.people_outline, 'tab': 3, 'color': AppColors.success},
    ];

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 4,
      crossAxisSpacing: 8,
      mainAxisSpacing: 8,
      childAspectRatio: 0.95,
      children: actions.map((act) {
        return AppCard(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          onTap: () => widget.onNavigateToTab(act['tab']),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: act['color'].withOpacity(0.08),
                child: Icon(act['icon'], color: act['color'], size: 18),
              ),
              const SizedBox(height: 8),
              Text(
                act['label'],
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 9.5),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  String _timeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 60) return '${diff.inMinutes} mins ago';
    if (diff.inHours < 24) return '${diff.inHours} hours ago';
    if (diff.inDays == 1) return 'Yesterday';
    return '${diff.inDays} days ago';
  }
}
