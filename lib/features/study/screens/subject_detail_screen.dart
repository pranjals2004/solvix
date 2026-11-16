import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/widgets/custom_widgets.dart';
import 'package:gate_resolver/core/providers/providers.dart';
import 'package:gate_resolver/data/models/subject.dart';
import 'package:gate_resolver/features/study/screens/notes_screen.dart';
import 'package:gate_resolver/features/study/screens/pyq_screen.dart';
import 'package:gate_resolver/data/models/question.dart';

class SubjectDetailScreen extends ConsumerStatefulWidget {
  final String subjectId;

  const SubjectDetailScreen({Key? key, required this.subjectId}) : super(key: key);

  @override
  ConsumerState<SubjectDetailScreen> createState() => _SubjectDetailScreenState();
}

class _SubjectDetailScreenState extends ConsumerState<SubjectDetailScreen> with SingleTickerProviderStateMixin {
  Subject? _subject;
  bool _isLoading = true;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadSubjectDetails();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _loadSubjectDetails() async {
    final studyService = ref.read(studyServiceProvider);
    final s = await studyService.getSubjectById(widget.subjectId);
    
    if (mounted) {
      if (s != null) {
        setState(() {
          _subject = s;
          _isLoading = false;
        });
      } else {
        // Fallback for subjects that are not in the main database list
        // Create a mock Subject instance to guarantee the screen works!
        final mockName = _getSubjectName(widget.subjectId);
        setState(() {
          _subject = Subject(
            id: widget.subjectId,
            name: mockName,
            questionsSolved: 12,
            progress: 0.25,
            topics: _getFallbackTopics(widget.subjectId),
          );
          _isLoading = false;
        });
      }
    }
  }

  String _getSubjectName(String id) {
    switch (id) {
      case 'sub_cn': return 'Computer Networks';
      case 'sub_db': return 'DBMS';
      case 'sub_os': return 'Operating Systems';
      case 'sub_algo': return 'Algorithms';
      case 'sub_ds': return 'Data Structures';
      case 'sub_dl': return 'Digital Logic';
      case 'sub_toc': return 'TOC';
      case 'sub_cd': return 'Compiler Design';
      case 'sub_coa': return 'Computer Organization';
      case 'sub_em': return 'Engineering Mathematics';
      case 'sub_ga': return 'General Aptitude';
      default: return 'GATE Subject';
    }
  }

  List<Topic> _getFallbackTopics(String subjectId) {
    if (subjectId == 'sub_cn') {
      return [
        Topic(id: 'top_cn_models', name: 'Network Models', isCompleted: true, notes: []),
        Topic(id: 'top_cn_tcp', name: 'TCP/UDP & Congestion', isCompleted: false, notes: []),
      ];
    }
    
    // Default list of general topics
    return [
      Topic(id: 'top_fall_1', name: 'Introduction to Concepts', isCompleted: true, notes: []),
      Topic(id: 'top_fall_2', name: 'Advanced Principles', isCompleted: false, notes: []),
      Topic(id: 'top_fall_3', name: 'Previous Year Analytics', isCompleted: false, notes: []),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Detail')),
        body: const LoadingState(title: 'Loading subject syllabus...'),
      );
    }

    if (_subject == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Not Found')),
        body: const Center(child: Text('Subject details could not be found.')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_subject!.name, style: const TextStyle(fontWeight: FontWeight.bold)),
        bottom: TabBar(
          controller: _tabController,
          labelColor: isDark ? AppColors.accentCyan : AppColors.primaryLight,
          unselectedLabelColor: isDark ? AppColors.textMutedDark : AppColors.textSecondaryLight,
          indicatorColor: isDark ? AppColors.accentCyan : AppColors.primaryLight,
          tabs: const [
            Tab(text: 'Notes'),
            Tab(text: 'PYQs'),
            Tab(text: 'Practice Set'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildNotesTab(isDark, theme),
          _buildPyqTab(isDark, theme),
          _buildPracticeTab(isDark, theme),
        ],
      ),
    );
  }

  // Notes Tab
  Widget _buildNotesTab(bool isDark, ThemeData theme) {
    final topics = _subject!.topics;
    if (topics.isEmpty) {
      return const EmptyState(
        title: 'Notes Unavailable',
        subtitle: 'Notes for this subject are currently being compiled by our academic team.',
        icon: Icons.menu_book,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: topics.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, idx) {
        final topic = topics[idx];
        return AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      topic.name,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ),
                  Icon(
                    topic.isCompleted ? Icons.check_circle : Icons.radio_button_unchecked,
                    color: topic.isCompleted ? AppColors.success : Colors.grey,
                    size: 20,
                  ),
                ],
              ),
              const SizedBox(height: 10),
              
              if (topic.notes.isEmpty)
                Text(
                  'No note sections available. Practice via PYQs.',
                  style: theme.textTheme.bodyMedium?.copyWith(fontStyle: FontStyle.italic),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: topic.notes.length,
                  separatorBuilder: (_, __) => const Divider(height: 16),
                  itemBuilder: (context, nIdx) {
                    final note = topic.notes[nIdx];
                    return InkWell(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => NotesScreen(
                              subjectId: _subject!.id,
                              topicId: topic.id,
                              noteSection: note,
                            ),
                          ),
                        ).then((_) => _loadSubjectDetails());
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                        child: Row(
                          children: [
                            const Icon(Icons.description_outlined, size: 18, color: AppColors.primaryLight),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    note.title,
                                    style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                                  ),
                                  Text(
                                    '${note.readTimeMinutes} min read • ${(note.progress * 100).toStringAsFixed(0)}% read',
                                    style: theme.textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.arrow_forward_ios, size: 12, color: Colors.grey),
                          ],
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        );
      },
    );
  }

  // PYQs Tab
  Widget _buildPyqTab(bool isDark, ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Previous Year Questions (PYQs)',
            style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text('Solve official GATE CSE questions sorted specifically for this subject to build exam readiness.'),
          const SizedBox(height: 24),
          
          AppCard(
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.assignment_outlined, color: AppColors.primaryLight),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text('All Subject PYQs', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                      Text('Solve questions from 2012 to 2025.', style: TextStyle(color: Colors.grey, fontSize: 11)),
                    ],
                  ),
                ),
                ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => PyqScreen(subjectName: _subject!.name),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryLight,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Solve'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Practice Tab
  Widget _buildPracticeTab(bool isDark, ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Practice Question Sets',
            style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text('Take subject-specific assessments modeled after the GATE exam format to refine your accuracy rates.'),
          const SizedBox(height: 24),

          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Topic-wise Mock Test', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    const DifficultyBadge(difficulty: QuestionDifficulty.medium),
                  ],
                ),
                const SizedBox(height: 8),
                const Text('10 Questions • 20 Minutes • Negative Marking', style: TextStyle(color: Colors.grey, fontSize: 12)),
                const SizedBox(height: 16),
                PrimaryButton(
                  text: 'Start Mock Practice',
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Mock tests will be connected in future backend version.')),
                    );
                  },
                  height: 40,
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}
