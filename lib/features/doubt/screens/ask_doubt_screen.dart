import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/widgets/custom_widgets.dart';
import 'package:gate_resolver/core/providers/providers.dart';
import 'package:gate_resolver/services/doubt_service.dart';
import 'package:gate_resolver/features/doubt/screens/solution_screen.dart';

class AskDoubtScreen extends ConsumerStatefulWidget {
  const AskDoubtScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<AskDoubtScreen> createState() => _AskDoubtScreenState();
}

class _AskDoubtScreenState extends ConsumerState<AskDoubtScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _formKey = GlobalKey<FormState>();
  final _questionController = TextEditingController();
  final _topicController = TextEditingController();
  
  String _selectedSubject = 'Computer Networks';
  String _selectedDifficulty = 'Medium';
  
  // Photo Mode State
  String? _selectedMockImage;
  String _optionalPhotoContext = '';
  bool _isCropping = false;
  
  // OCR processing stages state
  bool _isProcessing = false;
  int _processingStage = 0;
  OcrAnalysisResult? _ocrResult;
  bool _ocrFlowCompleted = false;

  final List<String> _subjects = [
    'Algorithms',
    'Data Structures',
    'DBMS',
    'Operating Systems',
    'Computer Networks',
    'Computer Organization',
    'Digital Logic',
    'TOC',
    'Compiler Design',
    'Engineering Mathematics',
    'General Aptitude'
  ];

  final List<String> _difficulties = ['Easy', 'Medium', 'Hard', 'Not sure'];

  // List of mock questions to simulate camera captures
  final List<Map<String, String>> _mockImages = [
    {
      'id': 'img_1',
      'label': 'Graph (BFS Complexity)',
      'description': 'A drawing of a directed graph with 6 nodes and 8 edges, labeled "Time complexity of BFS?"',
      'context': 'complexity',
      'path': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
    },
    {
      'id': 'img_2',
      'label': 'IP Router Header',
      'description': 'A schematic table showing an IP packet fragmentation format with MTU = 1500, size = 4404.',
      'context': 'router',
      'path': 'https://images.unsplash.com/photo-1544256718-3bcf237f3974?auto=format&fit=crop&w=300&q=80',
    },
    {
      'id': 'img_3',
      'label': 'TCP sliding window formula',
      'description': 'A hand-written whiteboard math equation showing RTT = 80ms, window = 64KB, capacity = 10Mbps.',
      'context': 'efficiency',
      'path': 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=300&q=80',
    }
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _questionController.dispose();
    _topicController.dispose();
    super.dispose();
  }

  // Simulate OCR stages
  void _startOcrProcessing(String imagePath, String contextTag) async {
    setState(() {
      _isProcessing = true;
      _processingStage = 0;
      _ocrFlowCompleted = false;
    });

    final doubtService = ref.read(doubtServiceProvider);

    // Stage 1: Uploading
    await Future.delayed(const Duration(milliseconds: 800));
    if (!mounted) return;
    setState(() => _processingStage = 1);

    // Stage 2: Reading question
    await Future.delayed(const Duration(milliseconds: 1000));
    if (!mounted) return;
    setState(() => _processingStage = 2);

    // Fetch result in background
    final result = await doubtService.analyzeImageDoubt(imagePath, contextTag);

    // Stage 3: Identifying subject
    if (!mounted) return;
    setState(() => _processingStage = 3);
    await Future.delayed(const Duration(milliseconds: 800));

    // Stage 4: Searching DB / Generating
    if (!mounted) return;
    setState(() => _processingStage = 4);
    await Future.delayed(const Duration(milliseconds: 800));

    if (!mounted) return;
    setState(() {
      _processingStage = 5; // Complete
      _isProcessing = false;
      _ocrResult = result;
      _ocrFlowCompleted = true;
    });
  }

  void _submitTextDoubt() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _isProcessing = true);
      
      final doubtService = ref.read(doubtServiceProvider);
      try {
        final doubt = await doubtService.submitTextDoubt(
          questionText: _questionController.text,
          subject: _selectedSubject,
          topic: _topicController.text.isEmpty ? 'General' : _topicController.text,
          difficulty: _selectedDifficulty,
        );

        if (!mounted) return;
        setState(() => _isProcessing = false);

        // Update user stats
        final user = ref.read(currentUserProvider);
        ref.read(currentUserProvider.notifier).state = user.copyWith(
          doubtsAsked: user.doubtsAsked + 1,
        );

        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => SolutionScreen(doubt: doubt),
          ),
        );
      } catch (e) {
        setState(() => _isProcessing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error resolving doubt: $e')),
        );
      }
    }
  }

  void _resolveOcrDoubt() async {
    if (_ocrResult == null) return;

    setState(() => _isProcessing = true);
    final doubtService = ref.read(doubtServiceProvider);
    
    try {
      final doubt = await doubtService.resolveExtractedDoubt(
        questionText: _ocrResult!.extractedQuestion,
        subject: _ocrResult!.subject,
        topic: _ocrResult!.topic,
        studentNotes: _optionalPhotoContext,
        runOcrFlow: _ocrResult!.foundInVerifiedDb,
      );

      if (!mounted) return;
      setState(() {
        _isProcessing = false;
        _ocrFlowCompleted = false;
        _ocrResult = null;
        _selectedMockImage = null;
        _optionalPhotoContext = '';
      });

      // Update user stats
      final user = ref.read(currentUserProvider);
      ref.read(currentUserProvider.notifier).state = user.copyWith(
        doubtsAsked: user.doubtsAsked + 1,
      );

      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => SolutionScreen(doubt: doubt),
        ),
      );
    } catch (e) {
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error getting solution: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (_isProcessing) {
      return Scaffold(
        body: _buildProcessingStageScreen(),
      );
    }

    if (_ocrFlowCompleted && _ocrResult != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Question Detected')),
        body: _buildDetectionResultScreen(),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Column(
          children: [
            Text('Ask Your Doubt', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            Text('Ask anything related to GATE CSE', style: theme.textTheme.bodySmall),
          ],
        ),
        elevation: 0,
        backgroundColor: Colors.transparent,
        bottom: TabBar(
          controller: _tabController,
          labelColor: isDark ? AppColors.accentCyan : AppColors.primaryLight,
          unselectedLabelColor: isDark ? AppColors.textMutedDark : AppColors.textSecondaryLight,
          indicatorColor: isDark ? AppColors.accentCyan : AppColors.primaryLight,
          tabs: const [
            Tab(icon: Icon(Icons.keyboard_outlined), text: 'Type Question'),
            Tab(icon: Icon(Icons.camera_alt_outlined), text: 'Upload Photo'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildTypeTextTab(),
          _buildUploadPhotoTab(),
        ],
      ),
    );
  }

  // Type Question Tab
  Widget _buildTypeTextTab() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Enter your GATE Question',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _questionController,
              maxLines: 6,
              style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimaryLight),
              decoration: InputDecoration(
                hintText: 'Explain your doubt here...\nExample: What is the time complexity of BFS when represented using an adjacency list?',
                hintStyle: TextStyle(color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
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
              ),
              validator: (val) => val == null || val.trim().isEmpty ? 'Please enter your doubt.' : null,
            ),
            const SizedBox(height: 20),
            
            // Dropdowns row
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Subject', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.cardDark : Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _selectedSubject,
                            isExpanded: true,
                            dropdownColor: isDark ? AppColors.backgroundDark : Colors.white,
                            items: _subjects.map((sub) {
                              return DropdownMenuItem(value: sub, child: Text(sub, style: const TextStyle(fontSize: 14)));
                            }).toList(),
                            onChanged: (val) {
                              if (val != null) setState(() => _selectedSubject = val);
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Difficulty', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.cardDark : Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _selectedDifficulty,
                            isExpanded: true,
                            dropdownColor: isDark ? AppColors.backgroundDark : Colors.white,
                            items: _difficulties.map((diff) {
                              return DropdownMenuItem(value: diff, child: Text(diff, style: const TextStyle(fontSize: 14)));
                            }).toList(),
                            onChanged: (val) {
                              if (val != null) setState(() => _selectedDifficulty = val);
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            
            Text('Topic (Optional)', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            TextFormField(
              controller: _topicController,
              style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimaryLight),
              decoration: InputDecoration(
                hintText: 'e.g. Graphs, IP Fragmentation',
                hintStyle: TextStyle(color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
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
              ),
            ),
            const SizedBox(height: 30),
            
            PrimaryButton(
              text: 'Resolve Doubt',
              icon: Icons.auto_awesome,
              onPressed: _submitTextDoubt,
            ),
          ],
        ),
      ),
    );
  }

  // Upload Photo Tab
  Widget _buildUploadPhotoTab() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (_selectedMockImage != null) {
      final selectedImageObj = _mockImages.firstWhere((img) => img['path'] == _selectedMockImage);
      return SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Photo Selected', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      ClipRRect(
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                        child: Image.network(
                          _selectedMockImage!,
                          height: 200,
                          width: double.infinity,
                          fit: BoxFit.cover,
                        ),
                      ),
                      if (_isCropping)
                        Container(
                          height: 200,
                          width: double.infinity,
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.5),
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                          ),
                          child: Center(
                            child: Container(
                              height: 140,
                              width: 240,
                              decoration: BoxDecoration(
                                border: Border.all(color: Colors.white, width: 2),
                              ),
                              child: Stack(
                                children: const [
                                  Align(alignment: Alignment.topLeft, child: Icon(Icons.crop_free, color: Colors.white)),
                                  Align(alignment: Alignment.topRight, child: Icon(Icons.crop_free, color: Colors.white)),
                                  Align(alignment: Alignment.bottomLeft, child: Icon(Icons.crop_free, color: Colors.white)),
                                  Align(alignment: Alignment.bottomRight, child: Icon(Icons.crop_free, color: Colors.white)),
                                ],
                              ),
                            ),
                          ),
                        ),
                      Positioned(
                        top: 8,
                        right: 8,
                        child: IconButton(
                          icon: const Icon(Icons.close, color: Colors.white),
                          style: IconButton.styleFrom(backgroundColor: Colors.black54),
                          onPressed: () => setState(() => _selectedMockImage = null),
                        ),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(selectedImageObj['label']!, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        const SizedBox(height: 4),
                        Text(selectedImageObj['description']!, style: theme.textTheme.bodyMedium),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: SecondaryButton(
                    text: _isCropping ? 'Apply Crop' : 'Crop Photo',
                    icon: Icons.crop_outlined,
                    onPressed: () {
                      setState(() => _isCropping = !_isCropping);
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: SecondaryButton(
                    text: 'Retake',
                    icon: Icons.refresh,
                    onPressed: () => setState(() {
                      _selectedMockImage = null;
                      _isCropping = false;
                    }),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Text('Add Optional Context/Hint', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            TextFormField(
              style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimaryLight),
              decoration: InputDecoration(
                hintText: 'e.g. Solve part (b) only, or focus on TCP timeout...',
                hintStyle: TextStyle(color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
                filled: true,
                fillColor: isDark ? AppColors.cardDark : Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: isDark ? Colors.white12 : Colors.black12),
                ),
              ),
              onChanged: (val) => _optionalPhotoContext = val,
            ),
            const SizedBox(height: 24),
            PrimaryButton(
              text: 'Analyze Question',
              icon: Icons.analytics_outlined,
              onPressed: () {
                _startOcrProcessing(_selectedMockImage!, selectedImageObj['context']!);
              },
            ),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Select a Mock Question to Upload', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Choose one of our pre-configured exam captures to simulate camera or gallery selection:'),
          const SizedBox(height: 16),
          
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 0.85,
            ),
            itemCount: _mockImages.length,
            itemBuilder: (context, idx) {
              final img = _mockImages[idx];
              return AppCard(
                padding: EdgeInsets.zero,
                onTap: () => setState(() => _selectedMockImage = img['path']),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                        child: Image.network(img['path']!, fit: BoxFit.cover),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(img['label']!, maxLines: 1, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          const SizedBox(height: 2),
                          Text('Simulated OCR Capture', style: theme.textTheme.bodySmall),
                        ],
                      ),
                    )
                  ],
                ),
              );
            },
          ),
          
          const SizedBox(height: 24),
          const Divider(),
          const SizedBox(height: 16),
          Text('Manual Options', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: SecondaryButton(
                  text: 'Take Photo',
                  icon: Icons.camera_alt,
                  onPressed: () {
                    // Load a default mock image
                    setState(() => _selectedMockImage = _mockImages[0]['path']);
                  },
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: SecondaryButton(
                  text: 'Gallery',
                  icon: Icons.photo_library,
                  onPressed: () {
                    // Load a default mock image
                    setState(() => _selectedMockImage = _mockImages[1]['path']);
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Center(
            child: Text(
              'Make sure the question is clearly visible in the photo.',
              style: theme.textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }

  // Processing Stages Layout
  Widget _buildProcessingStageScreen() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final List<Map<String, dynamic>> stages = [
      {'title': 'Image uploaded', 'icon': Icons.cloud_upload_outlined},
      {'title': 'Reading question (OCR)', 'icon': Icons.document_scanner_outlined},
      {'title': 'Identifying subject/topic', 'icon': Icons.subject_outlined},
      {'title': 'Searching verified solutions', 'icon': Icons.search_outlined},
      {'title': 'Generating explanation', 'icon': Icons.auto_awesome_outlined},
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 60),
      decoration: BoxDecoration(
        color: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(
            height: 80,
            width: 80,
            child: CircularProgressIndicator(
              strokeWidth: 5,
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.primaryLight),
            ),
          ),
          const SizedBox(height: 40),
          Text(
            'Analyzing Question',
            style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            'Running our pipeline to solve your doubt...',
            style: theme.textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 40),
          
          AppCard(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: stages.length,
              physics: const NeverScrollableScrollPhysics(),
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, idx) {
                final stage = stages[idx];
                final isDone = _processingStage > idx;
                final isActive = _processingStage == idx;
                
                Color statusColor;
                Widget trailing;

                if (isDone) {
                  statusColor = AppColors.success;
                  trailing = const Icon(Icons.check_circle, color: AppColors.success, size: 20);
                } else if (isActive) {
                  statusColor = AppColors.primaryLight;
                  trailing = const SizedBox(
                    height: 16,
                    width: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(AppColors.primaryLight)),
                  );
                } else {
                  statusColor = isDark ? Colors.white30 : Colors.black26;
                  trailing = const Icon(Icons.radio_button_unchecked, color: Colors.grey, size: 20);
                }

                return Row(
                  children: [
                    Icon(stage['icon'], color: statusColor, size: 22),
                    const SizedBox(width: 12),
                    Text(
                      stage['title'],
                      style: TextStyle(
                        color: statusColor,
                        fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                    const Spacer(),
                    trailing,
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // Detection Result Layout
  Widget _buildDetectionResultScreen() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 12),
          Center(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.success.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_outline, color: AppColors.success, size: 48),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              'OCR Analysis Successful',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 24),
          Text('Extracted Question', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          AppCard(
            color: isDark ? AppColors.cardDark : Colors.white,
            child: Text(
              _ocrResult!.extractedQuestion,
              style: theme.textTheme.bodyLarge?.copyWith(fontFamily: 'serif', fontStyle: FontStyle.italic),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Subject', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.cardDark : Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
                      ),
                      child: Text(_ocrResult!.subject),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Topic', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.cardDark : Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
                      ),
                      child: Text(_ocrResult!.topic),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          
          // Match alert
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: _ocrResult!.foundInVerifiedDb 
                  ? AppColors.primaryLight.withOpacity(0.08)
                  : AppColors.warning.withOpacity(0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: _ocrResult!.foundInVerifiedDb ? AppColors.primaryLight.withOpacity(0.3) : AppColors.warning.withOpacity(0.3),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  _ocrResult!.foundInVerifiedDb ? Icons.verified_outlined : Icons.auto_awesome,
                  color: _ocrResult!.foundInVerifiedDb ? AppColors.primaryLight : AppColors.warning,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _ocrResult!.foundInVerifiedDb 
                        ? 'Found matching verified GATE solution. Continue to view.'
                        : 'No direct database match. Generating dynamic explanation with Gemini.',
                    style: TextStyle(
                      color: _ocrResult!.foundInVerifiedDb ? AppColors.primaryLight : AppColors.warning,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          const Spacer(),
          Row(
            children: [
              Expanded(
                child: SecondaryButton(
                  text: 'Edit Question',
                  onPressed: () {
                    setState(() {
                      _questionController.text = _ocrResult!.extractedQuestion;
                      _selectedSubject = _ocrResult!.subject;
                      _topicController.text = _ocrResult!.topic;
                      _tabController.animateTo(0); // Switch to text tab
                      _ocrFlowCompleted = false;
                      _ocrResult = null;
                      _selectedMockImage = null;
                    });
                  },
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: PrimaryButton(
                  text: 'Continue',
                  onPressed: _resolveOcrDoubt,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}
