import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/widgets/math_text.dart';
import 'package:gate_resolver/core/providers/providers.dart';
import 'package:gate_resolver/data/models/subject.dart';

class NotesScreen extends ConsumerStatefulWidget {
  final String subjectId;
  final String topicId;
  final NoteSection noteSection;

  const NotesScreen({
    Key? key,
    required this.subjectId,
    required this.topicId,
    required this.noteSection,
  }) : super(key: key);

  @override
  ConsumerState<NotesScreen> createState() => _NotesScreenState();
}

class _NotesScreenState extends ConsumerState<NotesScreen> {
  double _scrollProgress = 0.0;
  final ScrollController _scrollController = ScrollController();
  bool _isBookmarked = false;

  @override
  void initState() {
    super.initState();
    _scrollProgress = widget.noteSection.progress;
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.position.pixels;
    
    if (maxScroll == 0) return;
    
    // Calculate progress fraction
    final progress = (currentScroll / maxScroll).clamp(0.0, 1.0);
    
    // Update progress only if it's greater than current saved progress
    if (progress > _scrollProgress) {
      setState(() {
        _scrollProgress = progress;
      });

      // If we read more than 90%, mark it as completed (100%)
      final savedProgress = progress > 0.9 ? 1.0 : progress;
      ref.read(studyServiceProvider).updateNoteProgress(
        widget.subjectId,
        widget.topicId,
        widget.noteSection.id,
        savedProgress,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.noteSection.title, style: const TextStyle(fontSize: 16)),
        actions: [
          IconButton(
            icon: Icon(
              _isBookmarked ? Icons.bookmark : Icons.bookmark_border,
              color: _isBookmarked ? AppColors.accentCyan : null,
            ),
            onPressed: () {
              setState(() => _isBookmarked = !_isBookmarked);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(_isBookmarked ? 'Added to Bookmarks' : 'Removed from Bookmarks'),
                  duration: const Duration(seconds: 1),
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Reading progress bar
          Container(
            height: 4,
            width: double.infinity,
            color: isDark ? Colors.white10 : Colors.black12,
            child: Align(
              alignment: Alignment.centerLeft,
              child: FractionallySizedBox(
                widthFactor: _scrollProgress,
                child: Container(color: AppColors.primaryLight),
              ),
            ),
          ),
          
          Expanded(
            child: SingleChildScrollView(
              controller: _scrollController,
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title metadata
                  Row(
                    children: [
                      const Icon(Icons.access_time, size: 16, color: Colors.grey),
                      const SizedBox(width: 4),
                      Text(
                        '${widget.noteSection.readTimeMinutes} min read',
                        style: theme.textTheme.bodySmall,
                      ),
                      const SizedBox(width: 16),
                      Text(
                        'Reading Progress: ${(_scrollProgress * 100).toStringAsFixed(0)}%',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: _scrollProgress >= 1.0 ? AppColors.success : null,
                          fontWeight: _scrollProgress >= 1.0 ? FontWeight.bold : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // Rich Markdown content
                  MathText(
                    widget.noteSection.contentMarkdown,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      height: 1.6,
                      fontSize: 16,
                    ),
                  ),
                  
                  const SizedBox(height: 40),
                  const Divider(),
                  const SizedBox(height: 20),
                  
                  // Page controllers
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                        },
                        icon: const Icon(Icons.arrow_back),
                        label: const Text('Back to Topic'),
                      ),
                      ElevatedButton.icon(
                        onPressed: () {
                          // Complete manually
                          ref.read(studyServiceProvider).updateNoteProgress(
                            widget.subjectId,
                            widget.topicId,
                            widget.noteSection.id,
                            1.0,
                          );
                          setState(() => _scrollProgress = 1.0);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Topic marked as Completed!'), duration: Duration(seconds: 1)),
                          );
                          Navigator.pop(context);
                        },
                        icon: const Icon(Icons.check),
                        label: const Text('Mark Complete'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.success,
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 30),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
