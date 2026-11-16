import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/widgets/custom_widgets.dart';
import 'package:gate_resolver/core/providers/providers.dart';
import 'package:gate_resolver/data/models/community_post.dart';
import 'package:gate_resolver/features/community/screens/community_detail_screen.dart';

class CommunityScreen extends ConsumerStatefulWidget {
  const CommunityScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends ConsumerState<CommunityScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _selectedFilter = 'All';
  List<CommunityPost> _posts = [];
  bool _isLoading = true;

  final List<String> _filters = [
    'All',
    'Algorithms',
    'DBMS',
    'Operating Systems',
    'Computer Networks',
    'TOC',
    'Digital Logic'
  ];

  @override
  void initState() {
    super.initState();
    _loadPosts();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _loadPosts() async {
    setState(() => _isLoading = true);
    final communityService = ref.read(communityServiceProvider);
    final results = await communityService.getCommunityPosts(subjectQuery: _selectedFilter);
    
    // Apply search filter if active
    final query = _searchController.text.trim().toLowerCase();
    List<CommunityPost> filteredResults = results;
    if (query.isNotEmpty) {
      filteredResults = results.where((p) =>
        p.questionText.toLowerCase().contains(query) ||
        (p.description != null && p.description!.toLowerCase().contains(query)) ||
        p.topic.toLowerCase().contains(query)
      ).toList();
    }

    if (mounted) {
      setState(() {
        _posts = filteredResults;
        _isLoading = false;
      });
    }
  }

  void _upvotePost(String id) async {
    final communityService = ref.read(communityServiceProvider);
    final updatedPost = await communityService.upvotePost(id);
    if (mounted) {
      setState(() {
        final idx = _posts.indexWhere((p) => p.id == id);
        if (idx != -1) _posts[idx] = updatedPost;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Community Discussion'),
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Search box
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: TextField(
              controller: _searchController,
              style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimaryLight),
              decoration: InputDecoration(
                hintText: 'Search doubts...',
                hintStyle: TextStyle(color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
                prefixIcon: const Icon(Icons.search, color: Colors.grey),
                filled: true,
                fillColor: isDark ? AppColors.cardDark : Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: isDark ? Colors.white12 : Colors.black12),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: isDark ? Colors.white12 : Colors.black12),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
              onChanged: (_) => _loadPosts(),
            ),
          ),

          // Horizontal Filter Chips
          SizedBox(
            height: 48,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: _filters.length,
              itemBuilder: (context, idx) {
                final filter = _filters[idx];
                final isSelected = _selectedFilter == filter;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4.0),
                  child: TopicChip(
                    label: filter,
                    isSelected: isSelected,
                    onTap: () {
                      setState(() => _selectedFilter = filter);
                      _loadPosts();
                    },
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // Posts List
          Expanded(
            child: _isLoading
                ? const LoadingState(title: 'Fetching discussions...')
                : _posts.isEmpty
                    ? const EmptyState(
                        title: 'No discussions found',
                        subtitle: 'Be the first to post a question on this subject!',
                        icon: Icons.forum_outlined,
                      )
                    : RefreshIndicator(
                        onRefresh: () async => _loadPosts(),
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _posts.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, idx) {
                            final post = _posts[idx];
                            return _buildPostCard(post, isDark, theme);
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildPostCard(CommunityPost post, bool isDark, ThemeData theme) {
    return AppCard(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => CommunityDetailScreen(postId: post.id),
          ),
        ).then((_) => _loadPosts()); // reload on back to show new comments/answers
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header info
          Row(
            children: [
              CircleAvatar(
                radius: 14,
                backgroundImage: NetworkImage(post.avatarUrl),
                backgroundColor: AppColors.primaryLight.withOpacity(0.1),
              ),
              const SizedBox(width: 8),
              Text(
                post.askedBy,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
              ),
              const SizedBox(width: 8),
              const Text('•', style: TextStyle(color: Colors.grey, fontSize: 12)),
              const SizedBox(width: 8),
              Text(
                _timeAgo(post.askedAt),
                style: const TextStyle(color: Colors.grey, fontSize: 11),
              ),
              const Spacer(),
              // Solved Status Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: post.isSolved ? AppColors.success.withOpacity(0.1) : AppColors.warning.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  post.isSolved ? 'Solved' : 'Open',
                  style: TextStyle(
                    color: post.isSolved ? AppColors.success : AppColors.warning,
                    fontWeight: FontWeight.bold,
                    fontSize: 10,
                  ),
                ),
              )
            ],
          ),
          const SizedBox(height: 10),

          // Question Title
          Text(
            post.questionText,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),

          // Description snippet
          if (post.description != null && post.description!.isNotEmpty) ...[
            Text(
              post.description!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 10),
          ],

          // Footer metrics and category
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  post.subject,
                  style: const TextStyle(color: AppColors.primaryLight, fontWeight: FontWeight.bold, fontSize: 11),
                ),
              ),
              const SizedBox(width: 8),
              Text(post.topic, style: const TextStyle(color: Colors.grey, fontSize: 11)),
              const Spacer(),
              
              // Upvote/Downvote actions
              InkWell(
                onTap: () => _upvotePost(post.id),
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.all(4.0),
                  child: Row(
                    children: [
                      const Icon(Icons.thumb_up_alt_outlined, size: 16, color: Colors.grey),
                      const SizedBox(width: 4),
                      Text('${post.upvotes}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 16),
              
              // Answers count
              Row(
                children: [
                  const Icon(Icons.mode_comment_outlined, size: 16, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text('${post.answersCount}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
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
