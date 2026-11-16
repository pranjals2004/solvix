import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/widgets/custom_widgets.dart';
import 'package:gate_resolver/core/widgets/math_text.dart';
import 'package:gate_resolver/core/providers/providers.dart';
import 'package:gate_resolver/data/models/community_post.dart';
import 'package:gate_resolver/data/mock/mock_data.dart';

class CommunityDetailScreen extends ConsumerStatefulWidget {
  final String postId;

  const CommunityDetailScreen({Key? key, required this.postId}) : super(key: key);

  @override
  ConsumerState<CommunityDetailScreen> createState() => _CommunityDetailScreenState();
}

class _CommunityDetailScreenState extends ConsumerState<CommunityDetailScreen> {
  CommunityPost? _post;
  bool _isLoading = true;
  final _answerController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadPostDetails();
  }

  @override
  void dispose() {
    _answerController.dispose();
    super.dispose();
  }

  void _loadPostDetails() async {
    final communityService = ref.read(communityServiceProvider);
    final p = await communityService.getPostById(widget.postId);
    if (mounted) {
      setState(() {
        _post = p;
        _isLoading = false;
      });
    }
  }

  void _upvotePost() async {
    if (_post == null) return;
    final communityService = ref.read(communityServiceProvider);
    final updated = await communityService.upvotePost(_post!.id);
    setState(() => _post = updated);
  }

  void _upvoteAnswer(String ansId) async {
    if (_post == null) return;
    final communityService = ref.read(communityServiceProvider);
    final updated = await communityService.upvoteAnswer(_post!.id, ansId);
    setState(() => _post = updated);
  }

  void _submitAnswer() async {
    if (!_formKey.currentState!.validate() || _post == null) return;

    setState(() => _isSubmitting = true);
    final communityService = ref.read(communityServiceProvider);
    final user = ref.read(currentUserProvider);

    try {
      final updatedPost = await communityService.submitAnswer(
        postId: _post!.id,
        answerMarkdown: _answerController.text.trim(),
        answeredBy: user.name,
      );

      if (!mounted) return;
      _answerController.clear();
      setState(() {
        _post = updatedPost;
        _isSubmitting = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Answer posted successfully!')),
      );
    } catch (e) {
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error posting answer: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Detail')),
        body: const LoadingState(title: 'Loading discussion thread...'),
      );
    }

    if (_post == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Not Found')),
        body: const Center(child: Text('This discussion thread does not exist.')),
      );
    }

    // Sort answers: best answer first, then by upvotes
    final sortedAnswers = List<CommunityAnswer>.from(_post!.answers);
    sortedAnswers.sort((a, b) {
      if (a.isBestAnswer && !b.isBestAnswer) return -1;
      if (!a.isBestAnswer && b.isBestAnswer) return 1;
      return b.upvotes.compareTo(a.upvotes);
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Thread Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.flag_outlined),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Post reported to moderators.')),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Topic and User row
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundImage: NetworkImage(_post!.avatarUrl),
                        backgroundColor: AppColors.primaryLight.withOpacity(0.1),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_post!.askedBy, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          Text(_timeAgo(_post!.askedAt), style: theme.textTheme.bodySmall),
                        ],
                      ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.thumb_up_alt_outlined, color: AppColors.primaryLight, size: 20),
                        onPressed: _upvotePost,
                      ),
                      Text('${_post!.upvotes}', style: const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Question title
                  Text(
                    _post!.questionText,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Detailed description
                  if (_post!.description != null && _post!.description!.isNotEmpty) ...[
                    AppCard(
                      color: isDark ? AppColors.cardDark : Colors.grey.shade50,
                      border: Border.all(color: isDark ? Colors.white10 : Colors.black.withOpacity(0.04)),
                      child: MathText(
                        _post!.description!,
                        style: theme.textTheme.bodyMedium?.copyWith(height: 1.45),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // Breadcrumbs / Tags
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          _post!.subject,
                          style: const TextStyle(color: AppColors.primaryLight, fontWeight: FontWeight.bold, fontSize: 11),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(_post!.topic, style: theme.textTheme.bodySmall),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Divider(),
                  const SizedBox(height: 12),

                  // Answers list title
                  Text(
                    'Answers (${_post!.answersCount})',
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),

                  if (sortedAnswers.isEmpty)
                    const EmptyState(
                      title: 'No answers yet',
                      subtitle: 'Be the first to help out this student by sharing your explanation.',
                      icon: Icons.chat_bubble_outline_rounded,
                    )
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: sortedAnswers.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, idx) {
                        final ans = sortedAnswers[idx];
                        return _buildAnswerCard(ans, isDark, theme);
                      },
                    ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),

          // Write an Answer Editor Tray
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              border: Border(
                top: BorderSide(
                  color: isDark ? Colors.white12 : Colors.black12,
                  width: 1,
                ),
              ),
            ),
            child: SafeArea(
              child: Form(
                key: _formKey,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _answerController,
                        maxLines: 3,
                        minLines: 1,
                        style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimaryLight),
                        decoration: InputDecoration(
                          hintText: 'Explain your solution here (supports text & math)...',
                          hintStyle: TextStyle(color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
                          filled: true,
                          fillColor: isDark ? AppColors.backgroundDark : Colors.grey.shade100,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.all(12),
                        ),
                        validator: (val) => val == null || val.trim().isEmpty ? 'Please type your answer.' : null,
                      ),
                    ),
                    const SizedBox(width: 8),
                    _isSubmitting
                        ? const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 12.0, vertical: 10),
                            child: SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2)),
                          )
                        : IconButton(
                            icon: const Icon(Icons.send, color: AppColors.primaryLight),
                            onPressed: _submitAnswer,
                          ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnswerCard(CommunityAnswer ans, bool isDark, ThemeData theme) {
    Color cardBgColor = isDark ? AppColors.cardDark : Colors.white;
    Border? cardBorder;

    // Highlight Best Answer
    if (ans.isBestAnswer) {
      cardBgColor = isDark ? AppColors.success.withOpacity(0.05) : AppColors.success.withOpacity(0.03);
      cardBorder = Border.all(color: AppColors.success.withOpacity(0.3), width: 1.5);
    }

    return AppCard(
      color: cardBgColor,
      border: cardBorder,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 14,
                backgroundImage: NetworkImage(ans.avatarUrl),
                backgroundColor: AppColors.primaryLight.withOpacity(0.1),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(ans.answeredBy, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  Text(_timeAgo(ans.answeredAt), style: theme.textTheme.bodySmall?.copyWith(fontSize: 10)),
                ],
              ),
              const Spacer(),
              if (ans.isBestAnswer)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.success.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.star, color: AppColors.success, size: 14),
                      SizedBox(width: 4),
                      Text(
                        'Best Answer',
                        style: TextStyle(color: AppColors.success, fontWeight: FontWeight.bold, fontSize: 10),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          MathText(
            ans.answerMarkdown,
            style: theme.textTheme.bodyMedium?.copyWith(height: 1.45),
          ),
          const SizedBox(height: 12),
          const Divider(),
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.thumb_up_alt_outlined, size: 16, color: Colors.grey),
                onPressed: () => _upvoteAnswer(ans.id),
              ),
              Text('${ans.upvotes}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
              const SizedBox(width: 16),
              const Icon(Icons.comment_outlined, size: 16, color: Colors.grey),
              const SizedBox(width: 4),
              Text('${ans.commentsCount}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
            ],
          ),
        ],
      ),
    );
  }

  String _timeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'Yesterday';
    return '${diff.inDays}d ago';
  }
}
