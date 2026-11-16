import 'package:gate_resolver/data/models/doubt.dart';

abstract class AIService {
  Future<List<ChatMessage>> askFollowUp({
    required Doubt doubt,
    required String userMessage,
    required List<ChatMessage> currentHistory,
  });
}

class MockAIService implements AIService {
  @override
  Future<List<ChatMessage>> askFollowUp({
    required Doubt doubt,
    required String userMessage,
    required List<ChatMessage> currentHistory,
  }) async {
    await Future.delayed(const Duration(seconds: 1)); // Simulating AI thinking

    final studentMsg = ChatMessage(
      sender: ChatMessageSender.student,
      text: userMessage,
      timestamp: DateTime.now(),
    );

    // Dynamic mock response based on keyword matching
    String replyText = "That is a great follow-up question! To understand this, remember that in ${doubt.subject} (${doubt.topic}), we have to satisfy the core constraints. Let me know if you would like me to write out a specific equation or step.";
    
    final lowerMsg = userMessage.toLowerCase();
    if (lowerMsg.contains('why') || lowerMsg.contains('how')) {
      replyText = "We apply this step because we need to normalize the values or align the boundaries according to the protocol rules. Specifically, dividing by 2 (or multiplying) is the result of half-subproblems in the recurrence relation, or dividing the buffer size by half.";
    } else if (lowerMsg.contains('formula') || lowerMsg.contains('equation')) {
      replyText = "The core formula we are using here is:\n\\[T(n) = aT(n/b) + f(n)\\]\nMake sure to check the values of \\(a\\) and \\(b\\) from the problem statement.";
    } else if (lowerMsg.contains('example') || lowerMsg.contains('show')) {
      replyText = "Sure! Let's take an example where \\(n = 8\\). Plugging it into the recurrence:\n\\[T(8) = 2T(4) + 8 = 2(2T(2) + 4) + 8 = 2(2(1) + 4) + 8 = 2(6) + 8 = 20\\]\nThis shows how the recurrence unwinds step-by-step.";
    }

    final aiMsg = ChatMessage(
      sender: ChatMessageSender.ai,
      text: replyText,
      timestamp: DateTime.now().add(const Duration(milliseconds: 100)),
    );

    return [...currentHistory, studentMsg, aiMsg];
  }
}
