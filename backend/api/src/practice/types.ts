import type { QuestionType } from '../content/types';
import type { SubmittedAnswer } from './grading';
import type { ExperimentArm } from '../domain/user';

export type SubmissionInput = {
  questionId: string;
  answer: SubmittedAnswer;
  timeTakenSec: number;
  confidence: number;
};

export type SubmissionResult = {
  isCorrect: boolean;
  solutionLatex: string;
  correctAnswer?: unknown;
  attemptNo: number;
  countedForRank: boolean;
  leaderboardWeekStart: string | null;
  rankExclusionReason: 'incorrect' | 'too_fast' | 'already_counted' | null;
  skillRatingBefore: number;
  skillRatingAfter: number;
  questionRatingBefore: number;
  questionRatingAfter: number;
  expected: number;
  kEffective: number;
};

export type QuestionForSubmission = {
  id: string;
  type: QuestionType;
  correctAnswer: unknown;
  natTolerance: number | null;
  solutionLatex: string;
};

export interface SubmissionRepository {
  submit(
    userId: string,
    arm: ExperimentArm,
    input: SubmissionInput,
  ): Promise<SubmissionResult | null>;
}

export type PracticeNextResult = {
  question: import('../content/types').PublicQuestion;
  isResurfaced: boolean;
  selectionMode: 'resurfaced' | 'random' | 'adaptive';
  skillRating: number;
};

export interface PracticeSelectionRepository {
  next(userId: string, arm: ExperimentArm, topicId?: string): Promise<PracticeNextResult | null>;
}

export type ProgressTopic = {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  rating: number;
  attempts: number;
  correct: number;
};

export type ProgressObservation = {
  topicId: string;
  confidence: number;
  outcome: boolean;
  createdAt: Date;
};

export type ProgressResult = { topics: ProgressTopic[]; observations: ProgressObservation[] };

export interface ProgressRepository {
  getProgress(userId: string): Promise<ProgressResult>;
}
