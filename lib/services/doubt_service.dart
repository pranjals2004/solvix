import 'package:gate_resolver/data/models/doubt.dart';
import 'package:gate_resolver/data/mock/mock_data.dart';

abstract class DoubtService {
  Future<List<Doubt>> getDoubtHistory();
  Future<Doubt?> getDoubtById(String id);
  Future<Doubt> submitTextDoubt({
    required String questionText,
    required String subject,
    required String topic,
    String? difficulty,
    String? studentNotes,
  });
  Future<OcrAnalysisResult> analyzeImageDoubt(String imagePath, String? optionalContext);
  Future<Doubt> resolveExtractedDoubt({
    required String questionText,
    required String subject,
    required String topic,
    String? studentNotes,
    required bool runOcrFlow, // simulate if OCR matched verified DB
  });
}

class OcrAnalysisResult {
  final String extractedQuestion;
  final String subject;
  final String topic;
  final bool foundInVerifiedDb;

  OcrAnalysisResult({
    required this.extractedQuestion,
    required this.subject,
    required this.topic,
    required this.foundInVerifiedDb,
  });
}

class MockDoubtService implements DoubtService {
  final List<Doubt> _inMemoryDoubts = List.from(MockData.doubtsHistory);

  @override
  Future<List<Doubt>> getDoubtHistory() async {
    await Future.delayed(const Duration(milliseconds: 600));
    return _inMemoryDoubts;
  }

  @override
  Future<Doubt?> getDoubtById(String id) async {
    await Future.delayed(const Duration(milliseconds: 300));
    try {
      return _inMemoryDoubts.firstWhere((d) => d.id == id);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<Doubt> submitTextDoubt({
    required String questionText,
    required String subject,
    required String topic,
    String? difficulty,
    String? studentNotes,
  }) async {
    await Future.delayed(const Duration(seconds: 2)); // Simulating processing
    
    // Check if we have a match in the questions database
    bool matched = false;
    String solution = "This is a custom-generated AI explanation for your doubt: '$questionText'.";
    List<String> steps = ["Understand the problem statement.", "Analyze the parameters.", "Apply core principles.", "Derive the final output."];
    String concept = "Custom Topic Overview";
    String tip = "Focus on the basics and standard formulas.";

    for (var q in MockData.questionsDatabase) {
      if (q.questionText.toLowerCase().contains(questionText.toLowerCase()) || 
          questionText.toLowerCase().contains(q.questionText.toLowerCase())) {
        matched = true;
        solution = q.explanation;
        steps = [
          "Understand the problem: ${q.concept}",
          "Analyze options: ${q.options.join(', ')}",
          "Follow the step-by-step logic to verify Option ${q.correctOptionLetter}."
        ];
        concept = q.concept;
        tip = "GATE PYQs often test variations of this core concept.";
        break;
      }
    }

    final newDoubt = Doubt(
      id: 'doubt_${DateTime.now().millisecondsSinceEpoch}',
      questionText: questionText,
      subject: subject,
      topic: topic,
      studentNotes: studentNotes,
      askedByUserId: 'student_1',
      createdAt: DateTime.now(),
      isResolved: true,
      isVerifiedSolution: matched,
      solutionMarkdown: solution,
      explanationSteps: steps,
      conceptSummary: concept,
      gateExamTip: tip,
      chatHistory: [],
    );

    _inMemoryDoubts.insert(0, newDoubt);
    return newDoubt;
  }

  @override
  Future<OcrAnalysisResult> analyzeImageDoubt(String imagePath, String? optionalContext) async {
    // Simulating OCR and classification pipeline delay
    await Future.delayed(const Duration(seconds: 3));

    // Determine return details based on what the user uploaded/passed
    // We can randomize or match a predefined image path indicator to simulate a specific GATE question
    if (optionalContext != null && optionalContext.toLowerCase().contains('complexity')) {
      return OcrAnalysisResult(
        extractedQuestion: 'What is the time complexity of BFS when represented using an adjacency list?',
        subject: 'Data Structures',
        topic: 'Graphs',
        foundInVerifiedDb: true,
      );
    } else if (optionalContext != null && optionalContext.toLowerCase().contains('router')) {
      return OcrAnalysisResult(
        extractedQuestion: 'An IP router with a Maximum Transmission Unit (MTU) of 1500 bytes has received an IP packet of size 4404 bytes with an IP header of length 20 bytes...',
        subject: 'Computer Networks',
        topic: 'IP Fragmentation',
        foundInVerifiedDb: true,
      );
    } else {
      // Default mock extraction representing a classic question
      return OcrAnalysisResult(
        extractedQuestion: 'Assume a TCP sender is transmitting packets with RTT of 80ms and window size 64KB over a 10 Mbps channel. Compute the efficiency of transmission.',
        subject: 'Computer Networks',
        topic: 'Sliding Window Protocol',
        foundInVerifiedDb: false, // Will generate an AI solution
      );
    }
  }

  @override
  Future<Doubt> resolveExtractedDoubt({
    required String questionText,
    required String subject,
    required String topic,
    String? studentNotes,
    required bool runOcrFlow,
  }) async {
    await Future.delayed(const Duration(seconds: 1));

    // Try to match in DB
    bool matched = runOcrFlow;
    String solution = "AI Generated: The solution to this question was generated dynamically by Gemini.";
    List<String> steps = ["Parse input variables.", "Check mathematical constraints.", "Evaluate final answer."];
    String concept = "Sliding Window Throughput";
    String tip = "Practice calculations involving window sizes carefully.";

    for (var q in MockData.questionsDatabase) {
      if (q.questionText.toLowerCase().contains(questionText.toLowerCase()) ||
          questionText.toLowerCase().contains(q.questionText.toLowerCase())) {
        matched = true;
        solution = q.explanation;
        steps = [
          "Focus on the core concept: ${q.concept}",
          "Evaluate constraints: ${q.topic}",
          "Select the correct answer option: ${q.options[q.correctOptionIndex]}"
        ];
        concept = q.concept;
        tip = "Remember this tip: Always double check conversion units (e.g. KB to bits).";
        break;
      }
    }

    final newDoubt = Doubt(
      id: 'doubt_${DateTime.now().millisecondsSinceEpoch}',
      questionText: questionText,
      subject: subject,
      topic: topic,
      studentNotes: studentNotes,
      askedByUserId: 'student_1',
      createdAt: DateTime.now(),
      isResolved: true,
      isVerifiedSolution: matched,
      solutionMarkdown: solution,
      explanationSteps: steps,
      conceptSummary: concept,
      gateExamTip: tip,
      chatHistory: [],
    );

    _inMemoryDoubts.insert(0, newDoubt);
    return newDoubt;
  }
}
