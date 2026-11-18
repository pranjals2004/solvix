export type QuestionType = 'mcq' | 'msq' | 'nat' | 'short';

export type SubjectRecord = { id: string; name: string; slug: string };
export type TopicRecord = { id: string; subjectId: string; name: string; slug: string };

export type QuestionInput = {
  subjectId: string;
  topicId: string;
  type: QuestionType;
  statementLatex: string;
  optionsJson: string[];
  correctAnswerJson: string | number | string[] | Record<string, unknown>;
  natTolerance: number | null;
  solutionLatex: string;
  isPyq: boolean;
  pyqYear: number | null;
  difficultyRating: number;
};

export type AdminQuestion = QuestionInput & {
  id: string;
  attemptCount: number;
  createdAt: Date;
};

export type PublicQuestion = {
  id: string;
  subjectId: string;
  topicId: string;
  type: QuestionType;
  statementLatex: string;
  optionsJson: string[];
  isPyq: boolean;
  pyqYear: number | null;
  difficultyRating: number;
};

export type QuestionFilters = {
  subjectId?: string;
  topicId?: string;
  pyq?: boolean;
  year?: number;
  limit: number;
  offset: number;
};

export type NoteInput = {
  subjectId: string;
  topicId: string;
  title: string;
  content: string;
};

export type NoteRecord = NoteInput & {
  id: string;
  updatedAt: Date;
};

export type EmbeddedChunk = {
  chunkIndex: number;
  content: string;
  embedding: number[];
};

export type PreparedQuestion = {
  id?: string;
  input: QuestionInput;
  solutionChunks: EmbeddedChunk[];
};

export type PreparedNote = {
  id?: string;
  input: NoteInput;
  chunks: EmbeddedChunk[];
};

export interface ContentRepository {
  listSubjects(): Promise<SubjectRecord[]>;
  listTopics(subjectId: string): Promise<TopicRecord[]>;
  listQuestions(filters: QuestionFilters): Promise<PublicQuestion[]>;
  listAdminQuestions(filters: QuestionFilters): Promise<AdminQuestion[]>;
  getPublicQuestion(id: string): Promise<PublicQuestion | null>;
  getAdminQuestion(id: string): Promise<AdminQuestion | null>;
  listNotes(topicId: string): Promise<NoteRecord[]>;
  findTopicBySlugs(subjectSlug: string, topicSlug: string): Promise<TopicRecord | null>;

  createSubject(input: { name: string; slug: string }): Promise<SubjectRecord>;
  updateSubject(id: string, input: { name?: string; slug?: string }): Promise<SubjectRecord | null>;
  deleteSubject(id: string): Promise<boolean>;
  createTopic(input: { subjectId: string; name: string; slug: string }): Promise<TopicRecord>;
  updateTopic(id: string, input: { name?: string; slug?: string }): Promise<TopicRecord | null>;
  deleteTopic(id: string): Promise<boolean>;

  saveQuestion(
    id: string | undefined,
    input: QuestionInput,
    chunks: EmbeddedChunk[],
  ): Promise<AdminQuestion | null>;
  deleteQuestion(id: string): Promise<boolean>;
  saveNote(id: string | undefined, input: NoteInput, chunks: EmbeddedChunk[]): Promise<NoteRecord | null>;
  deleteNote(id: string): Promise<boolean>;
  importContent(questions: PreparedQuestion[], notes: PreparedNote[]): Promise<{ questions: number; notes: number }>;
}
