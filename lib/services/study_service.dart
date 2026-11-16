import 'package:gate_resolver/data/models/subject.dart';
import 'package:gate_resolver/data/mock/mock_data.dart';

abstract class StudyService {
  Future<List<Subject>> getSubjects();
  Future<Subject?> getSubjectById(String id);
  Future<Topic?> getTopicById(String subjectId, String topicId);
  Future<void> updateNoteProgress(String subjectId, String topicId, String noteId, double progress);
}

class MockStudyService implements StudyService {
  final List<Subject> _subjects = List.from(MockData.subjects);

  @override
  Future<List<Subject>> getSubjects() async {
    await Future.delayed(const Duration(milliseconds: 300));
    return _subjects;
  }

  @override
  Future<Subject?> getSubjectById(String id) async {
    await Future.delayed(const Duration(milliseconds: 200));
    try {
      return _subjects.firstWhere((s) => s.id == id);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<Topic?> getTopicById(String subjectId, String topicId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    try {
      final subject = _subjects.firstWhere((s) => s.id == subjectId);
      return subject.topics.firstWhere((t) => t.id == topicId);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> updateNoteProgress(String subjectId, String topicId, String noteId, double progress) async {
    // In-memory simulation
    final subIndex = _subjects.indexWhere((s) => s.id == subjectId);
    if (subIndex != -1) {
      final subject = _subjects[subIndex];
      final topIndex = subject.topics.indexWhere((t) => t.id == topicId);
      if (topIndex != -1) {
        final topic = subject.topics[topIndex];
        final updatedNotes = topic.notes.map((note) {
          if (note.id == noteId) {
            return NoteSection(
              id: note.id,
              title: note.title,
              readTimeMinutes: note.readTimeMinutes,
              contentMarkdown: note.contentMarkdown,
              progress: progress,
            );
          }
          return note;
        }).toList();
        
        // Calculate new topic details
        final updatedTopic = Topic(
          id: topic.id,
          name: topic.name,
          isCompleted: updatedNotes.every((n) => n.progress >= 1.0),
          notes: updatedNotes,
        );

        final updatedTopics = List<Topic>.from(subject.topics);
        updatedTopics[topIndex] = updatedTopic;

        // Calculate new subject progress
        final completedTopics = updatedTopics.where((t) => t.isCompleted).length;
        final totalTopics = updatedTopics.length;
        final double newProgress = totalTopics > 0 ? completedTopics / totalTopics : subject.progress;

        _subjects[subIndex] = Subject(
          id: subject.id,
          name: subject.name,
          questionsSolved: subject.questionsSolved,
          progress: newProgress,
          topics: updatedTopics,
        );
      }
    }
  }
}
