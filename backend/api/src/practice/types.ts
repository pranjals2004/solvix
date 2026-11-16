import type { QuestionType } from '../content/types';
import type { SubmittedAnswer } from './grading';

export type SubmissionInput = {
  questionId: string;
  answer: SubmittedAnswer;
  timeTakenSec: number;
  confidence: number;
};

export type SubmissionResult = {
  isCorrect: boolean;
  solutionLatex: string;
  attemptNo: number;
};

export type QuestionForSubmission = {
  id: string;
  type: QuestionType;
  correctAnswer: unknown;
  natTolerance: number | null;
  solutionLatex: string;
};

export interface SubmissionRepository {
  submit(userId: string, input: SubmissionInput): Promise<SubmissionResult | null>;
}
