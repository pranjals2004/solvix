import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/core/constants/app_colors.dart';
import 'package:gate_resolver/core/widgets/custom_widgets.dart';
import 'package:gate_resolver/core/providers/providers.dart';
import 'package:gate_resolver/data/models/doubt.dart';

class PostCommunityScreen extends ConsumerStatefulWidget {
  final Doubt doubt;

  const PostCommunityScreen({Key? key, required this.doubt}) : super(key: key);

  @override
  ConsumerState<PostCommunityScreen> createState() => _PostCommunityScreenState();
}

class _PostCommunityScreenState extends ConsumerState<PostCommunityScreen> {
  final _descriptionController = TextEditingController();
  bool _isAnonymous = false;
  bool _isLoading = false;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  void _postToCommunity() async {
    setState(() => _isLoading = true);

    final communityService = ref.read(communityServiceProvider);
    
    try {
      await communityService.createPost(
        questionText: widget.doubt.questionText,
        subject: widget.doubt.subject,
        topic: widget.doubt.topic,
        description: _descriptionController.text.trim().isEmpty 
            ? 'I resolved this using GATE Resolver AI, but wanted to share and discuss alternative solutions!' 
            : _descriptionController.text.trim(),
        anonymous: _isAnonymous,
      );

      if (!mounted) return;
      setState(() => _isLoading = false);

      // Show confirmation dialog or success message and pop
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) {
          return AlertDialog(
            title: const Row(
              children: [
                Icon(Icons.check_circle_outline, color: AppColors.success),
                SizedBox(width: 8),
                Text('Posted Successfully'),
              ],
            ),
            content: const Text('Your doubt has been posted to the community board. Other students and tutors can now view and comment on it.'),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context); // Pop dialog
                  Navigator.pop(context); // Pop PostCommunityScreen
                },
                child: const Text('OK'),
              ),
            ],
          );
        },
      );
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error posting: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Post to Community'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Confirm Post Details', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text('Publish this doubt to the shared community forum to discuss with other aspirants.'),
            const SizedBox(height: 16),
            
            // Question summary card
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
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
                          widget.doubt.subject,
                          style: const TextStyle(color: AppColors.primaryLight, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(widget.doubt.topic, style: theme.textTheme.bodySmall),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.doubt.questionText,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontStyle: FontStyle.italic, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            
            Text('Description / Your Explanation (Optional)', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _descriptionController,
              maxLines: 4,
              style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimaryLight),
              decoration: InputDecoration(
                hintText: 'Add notes about what parts you found tricky, or explain your line of reasoning...',
                hintStyle: TextStyle(color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
                filled: true,
                fillColor: isDark ? AppColors.cardDark : Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: isDark ? Colors.white12 : Colors.black12),
                ),
              ),
            ),
            const SizedBox(height: 16),
            
            // Privacy Toggle
            CheckboxListTile(
              value: _isAnonymous,
              title: const Text('Post Anonymously'),
              subtitle: const Text('Hide your name and avatar from this post.'),
              contentPadding: EdgeInsets.zero,
              activeColor: AppColors.primaryLight,
              onChanged: (val) {
                if (val != null) setState(() => _isAnonymous = val);
              },
            ),
            const SizedBox(height: 30),
            
            PrimaryButton(
              text: 'Post Doubt',
              icon: Icons.send_rounded,
              isLoading: _isLoading,
              onPressed: _postToCommunity,
            ),
          ],
        ),
      ),
    );
  }
}
