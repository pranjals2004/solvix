import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/widgets/custom_widgets.dart';
import 'package:gate_resolver/core/providers/providers.dart';
import 'package:gate_resolver/data/models/subject.dart';
import 'package:gate_resolver/features/study/screens/subject_detail_screen.dart';

class StudyScreen extends ConsumerStatefulWidget {
  const StudyScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<StudyScreen> createState() => _StudyScreenState();
}

class _StudyScreenState extends ConsumerState<StudyScreen> {
  List<Subject> _subjects = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSubjects();
  }

  void _loadSubjects() async {
    final studyService = ref.read(studyServiceProvider);
    final results = await studyService.getSubjects();
    if (mounted) {
      setState(() {
        _subjects = results;
        _isLoading = false;
      });
    }
  }

  // Define subjects that aren't populated fully in the mock data,
  // to make the grid look extensive and cover all GATE requirements.
  final List<Map<String, dynamic>> _allGateSubjects = [
    {'id': 'sub_cn', 'name': 'Computer Networks', 'defaultProgress': 0.72, 'defaultSolved': 34, 'topicsCount': 11},
    {'id': 'sub_db', 'name': 'DBMS', 'defaultProgress': 0.61, 'defaultSolved': 25, 'topicsCount': 8},
    {'id': 'sub_os', 'name': 'Operating Systems', 'defaultProgress': 0.54, 'defaultSolved': 18, 'topicsCount': 9},
    {'id': 'sub_algo', 'name': 'Algorithms', 'defaultProgress': 0.48, 'defaultSolved': 42, 'topicsCount': 10},
    {'id': 'sub_ds', 'name': 'Data Structures', 'defaultProgress': 0.65, 'defaultSolved': 30, 'topicsCount': 7},
    {'id': 'sub_dl', 'name': 'Digital Logic', 'defaultProgress': 0.80, 'defaultSolved': 15, 'topicsCount': 6},
    {'id': 'sub_toc', 'name': 'TOC', 'defaultProgress': 0.42, 'defaultSolved': 20, 'topicsCount': 8},
    {'id': 'sub_cd', 'name': 'Compiler Design', 'defaultProgress': 0.35, 'defaultSolved': 12, 'topicsCount': 7},
    {'id': 'sub_coa', 'name': 'Computer Organization', 'defaultProgress': 0.30, 'defaultSolved': 8, 'topicsCount': 10},
    {'id': 'sub_em', 'name': 'Engineering Mathematics', 'defaultProgress': 0.50, 'defaultSolved': 22, 'topicsCount': 9},
    {'id': 'sub_ga', 'name': 'General Aptitude', 'defaultProgress': 0.85, 'defaultSolved': 45, 'topicsCount': 5},
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('GATE Syllabus & Studies'),
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: _isLoading 
          ? const LoadingState(title: 'Loading syllabus modules...')
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'GATE CSE Syllabus',
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  const Text('Click on any subject to read study notes and practice previous year questions.'),
                  const SizedBox(height: 20),

                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 0.95,
                    ),
                    itemCount: _allGateSubjects.length,
                    itemBuilder: (context, idx) {
                      final item = _allGateSubjects[idx];
                      
                      // Match with our local list if loaded
                      final loadedSub = _subjects.firstWhere(
                        (s) => s.id == item['id'],
                        orElse: () => Subject(
                          id: item['id'],
                          name: item['name'],
                          questionsSolved: item['defaultSolved'],
                          progress: item['defaultProgress'],
                          topics: [],
                        ),
                      );

                      return _buildSubjectCard(loadedSub, item['topicsCount'], isDark, theme);
                    },
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
    );
  }

  Widget _buildSubjectCard(Subject subject, int totalTopics, bool isDark, ThemeData theme) {
    return AppCard(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => SubjectDetailScreen(subjectId: subject.id),
          ),
        ).then((_) => _loadSubjects()); // reload to reflect reading progress updates
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                subject.name,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 6),
              Text(
                '$totalTopics Topics • ${subject.questionsSolved} Solved',
                style: theme.textTheme.bodySmall,
              ),
            ],
          ),
          
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Progress', style: TextStyle(fontSize: 11, color: Colors.grey)),
                  Text(
                    '${(subject.progress * 100).toStringAsFixed(0)}%',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primaryLight),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              AppProgressBar(
                progress: subject.progress,
                color: AppColors.primaryLight,
                height: 6,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
