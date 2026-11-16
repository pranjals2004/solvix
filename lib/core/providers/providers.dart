import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gate_resolver/data/mock/mock_data.dart';
import 'package:gate_resolver/data/models/user.dart';
import 'package:gate_resolver/services/doubt_service.dart';
import 'package:gate_resolver/services/ai_service.dart';
import 'package:gate_resolver/services/question_service.dart';
import 'package:gate_resolver/services/community_service.dart';
import 'package:gate_resolver/services/study_service.dart';

// Service Providers
final doubtServiceProvider = Provider<DoubtService>((ref) {
  return MockDoubtService();
});

final aiServiceProvider = Provider<AIService>((ref) {
  return MockAIService();
});

final questionServiceProvider = Provider<QuestionService>((ref) {
  return MockQuestionService();
});

final communityServiceProvider = Provider<CommunityService>((ref) {
  return MockCommunityService();
});

final studyServiceProvider = Provider<StudyService>((ref) {
  return MockStudyService();
});

// App State Providers
final currentUserProvider = StateProvider<UserProfile>((ref) {
  return MockData.currentUser;
});

class ThemeNotifier extends StateNotifier<ThemeMode> {
  ThemeNotifier() : super(ThemeMode.light);

  void toggleTheme() {
    state = state == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
  }
  
  void setTheme(ThemeMode mode) {
    state = mode;
  }
}

final themeModeProvider = StateNotifierProvider<ThemeNotifier, ThemeMode>((ref) {
  return ThemeNotifier();
});
