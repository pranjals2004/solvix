import 'package:gate_resolver/data/models/community_post.dart';
import 'package:gate_resolver/data/mock/mock_data.dart';

abstract class CommunityService {
  Future<List<CommunityPost>> getCommunityPosts({String? subjectQuery});
  Future<CommunityPost?> getPostById(String id);
  Future<CommunityPost> createPost({
    required String questionText,
    required String subject,
    required String topic,
    String? description,
    String? imageUrl,
    required bool anonymous,
  });
  Future<CommunityPost> submitAnswer({
    required String postId,
    required String answerMarkdown,
    required String answeredBy,
  });
  Future<CommunityPost> upvotePost(String postId);
  Future<CommunityPost> upvoteAnswer(String postId, String answerId);
}

class MockCommunityService implements CommunityService {
  final List<CommunityPost> _posts = List.from(MockData.communityPosts);

  @override
  Future<List<CommunityPost>> getCommunityPosts({String? subjectQuery}) async {
    await Future.delayed(const Duration(milliseconds: 500));
    if (subjectQuery == null || subjectQuery == 'All' || subjectQuery.isEmpty) {
      return _posts;
    }
    return _posts.where((p) => p.subject.toLowerCase() == subjectQuery.toLowerCase() || p.subject.toLowerCase().contains(subjectQuery.toLowerCase())).toList();
  }

  @override
  Future<CommunityPost?> getPostById(String id) async {
    await Future.delayed(const Duration(milliseconds: 300));
    try {
      return _posts.firstWhere((p) => p.id == id);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<CommunityPost> createPost({
    required String questionText,
    required String subject,
    required String topic,
    String? description,
    String? imageUrl,
    required bool anonymous,
  }) async {
    await Future.delayed(const Duration(seconds: 1));
    
    final newPost = CommunityPost(
      id: 'post_${DateTime.now().millisecondsSinceEpoch}',
      questionText: questionText,
      subject: subject,
      topic: topic,
      askedBy: anonymous ? 'Anonymous Student' : MockData.currentUser.name,
      avatarUrl: anonymous 
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80' // default avatar
          : MockData.currentUser.avatarUrl,
      askedAt: DateTime.now(),
      upvotes: 1,
      isSolved: false,
      description: description,
      imageUrl: imageUrl,
      answers: [],
    );

    _posts.insert(0, newPost);
    return newPost;
  }

  @override
  Future<CommunityPost> submitAnswer({
    required String postId,
    required String answerMarkdown,
    required String answeredBy,
  }) async {
    await Future.delayed(const Duration(milliseconds: 800));
    final postIndex = _posts.indexWhere((p) => p.id == postId);
    if (postIndex == -1) throw Exception("Post not found");

    final post = _posts[postIndex];
    final newAnswer = CommunityAnswer(
      id: 'ans_${DateTime.now().millisecondsSinceEpoch}',
      answeredBy: answeredBy,
      avatarUrl: MockData.currentUser.avatarUrl,
      answeredAt: DateTime.now(),
      answerMarkdown: answerMarkdown,
      upvotes: 0,
      isBestAnswer: false,
      commentsCount: 0,
    );

    final updatedPost = post.copyWith(
      answers: [...post.answers, newAnswer],
    );

    _posts[postIndex] = updatedPost;
    return updatedPost;
  }

  @override
  Future<CommunityPost> upvotePost(String postId) async {
    final postIndex = _posts.indexWhere((p) => p.id == postId);
    if (postIndex == -1) throw Exception("Post not found");

    final post = _posts[postIndex];
    final updatedPost = post.copyWith(upvotes: post.upvotes + 1);
    _posts[postIndex] = updatedPost;
    return updatedPost;
  }

  @override
  Future<CommunityPost> upvoteAnswer(String postId, String answerId) async {
    final postIndex = _posts.indexWhere((p) => p.id == postId);
    if (postIndex == -1) throw Exception("Post not found");

    final post = _posts[postIndex];
    final updatedAnswers = post.answers.map((ans) {
      if (ans.id == answerId) {
        return ans.copyWith(upvotes: ans.upvotes + 1);
      }
      return ans;
    }).toList();

    final updatedPost = post.copyWith(answers: updatedAnswers);
    _posts[postIndex] = updatedPost;
    return updatedPost;
  }
}
