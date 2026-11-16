import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/widgets/custom_widgets.dart';
import 'package:gate_resolver/core/providers/providers.dart';
import 'package:gate_resolver/data/models/doubt.dart';
import 'package:gate_resolver/features/doubt/screens/solution_screen.dart';

class DoubtHistoryScreen extends ConsumerStatefulWidget {
  const DoubtHistoryScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<DoubtHistoryScreen> createState() => _DoubtHistoryScreenState();
}

class _DoubtHistoryScreenState extends ConsumerState<DoubtHistoryScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _selectedFilter = 'All';
  List<Doubt> _doubts = [];
  bool _isLoading = true;

  final List<String> _filters = ['All', 'Solved', 'Unsolved', 'Verified', 'AI Generated'];

  @override
  void initState() {
    super.initState();
    _loadDoubtHistory();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _loadDoubtHistory() async {
    setState(() => _isLoading = true);
    
    final doubtService = ref.read(doubtServiceProvider);
    final history = await doubtService.getDoubtHistory();
    
    // Apply filters
    List<Doubt> filteredList = history;
    if (_selectedFilter == 'Solved') {
      filteredList = history.where((d) => d.isResolved).toList();
    } else if (_selectedFilter == 'Unsolved') {
      filteredList = history.where((d) => !d.isResolved).toList();
    } else if (_selectedFilter == 'Verified') {
      filteredList = history.where((d) => d.isVerifiedSolution).toList();
    } else if (_selectedFilter == 'AI Generated') {
      filteredList = history.where((d) => !d.isVerifiedSolution).toList();
    }

    // Apply search query
    final query = _searchController.text.trim().toLowerCase();
    if (query.isNotEmpty) {
      filteredList = filteredList.where((d) => 
        d.questionText.toLowerCase().contains(query) || 
        d.subject.toLowerCase().contains(query) || 
        d.topic.toLowerCase().contains(query)
      ).toList();
    }

    if (mounted) {
      setState(() {
        _doubts = filteredList;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Doubt History'),
      ),
      body: Column(
        children: [
          // Search box
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimaryLight),
              decoration: InputDecoration(
                hintText: 'Search my doubts...',
                hintStyle: TextStyle(color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: isDark ? AppColors.cardDark : Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: isDark ? Colors.white10 : Colors.black12),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: isDark ? Colors.white10 : Colors.black12),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
              onChanged: (_) => _loadDoubtHistory(),
            ),
          ),

          // Filters row
          SizedBox(
            height: 40,
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
                      _loadDoubtHistory();
                    },
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 12),

          // History list
          Expanded(
            child: _isLoading
                ? const LoadingState(title: 'Retrieving your history...')
                : _doubts.isEmpty
                    ? const EmptyState(
                        title: 'No doubts found',
                        subtitle: 'Tap the "+" icon or go to Ask Doubt tab to solve your first question!',
                        icon: Icons.history_edu_outlined,
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _doubts.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, idx) {
                          final doubt = _doubts[idx];
                          return _buildDoubtCard(doubt, isDark, theme);
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildDoubtCard(Doubt doubt, bool isDark, ThemeData theme) {
    return AppCard(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => SolutionScreen(doubt: doubt),
          ),
        ).then((_) => _loadDoubtHistory());
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
                      doubt.subject,
                      style: const TextStyle(color: AppColors.primaryLight, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(doubt.topic, style: theme.textTheme.bodySmall),
                ],
              ),
              // Source type badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: doubt.isVerifiedSolution 
                      ? AppColors.success.withOpacity(0.1) 
                      : AppColors.secondaryLight.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  doubt.isVerifiedSolution ? 'Verified' : 'AI Gen',
                  style: TextStyle(
                    color: doubt.isVerifiedSolution ? AppColors.success : AppColors.secondaryLight,
                    fontWeight: FontWeight.bold,
                    fontSize: 9,
                  ),
                ),
              )
            ],
          ),
          const SizedBox(height: 8),
          Text(
            doubt.questionText,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Asked on ${_formatDate(doubt.createdAt)}',
                style: theme.textTheme.bodySmall,
              ),
              const Icon(Icons.arrow_forward_ios, size: 12, color: Colors.grey),
            ],
          )
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}
