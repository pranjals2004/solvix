export type DoubtStatus = 'pending' | 'processing' | 'done' | 'failed';
export type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
};

export type DoubtRecord = {
  id: string;
  userId: string;
  questionId: string | null;
  text: string | null;
  imageKey: string | null;
  status: DoubtStatus;
  conversation: ConversationMessage[];
  aiResponse: string | null;
  retrievalContext: RetrievalContext | null;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

export type RetrievalChunk = {
  id: string;
  title: string;
  content: string;
  sourceType: 'note' | 'solution';
  sourceId: string;
  topicId: string;
  similarity: number;
};

export type RetrievalContext = {
  questionId: string | null;
  questionStatement: string | null;
  questionSolution: string | null;
  topicId: string | null;
  chunks: RetrievalChunk[];
};

export type NewDoubt = {
  userId: string;
  questionId: string | null;
  text: string | null;
  imageKey: string | null;
  idempotencyKey: string;
  initialMessage: ConversationMessage;
};

export interface DoubtRepository {
  create(input: NewDoubt): Promise<{ doubt: DoubtRecord; created: boolean }>;
  getForUser(userId: string, doubtId: string): Promise<DoubtRecord | null>;
  getById(doubtId: string): Promise<DoubtRecord | null>;
  appendUserMessage(userId: string, doubtId: string, message: ConversationMessage): Promise<DoubtRecord | null>;
  setProcessing(doubtId: string): Promise<void>;
  getRetrievalContext(doubtId: string, embedding: number[]): Promise<RetrievalContext | null>;
  complete(doubtId: string, answer: string, context: RetrievalContext): Promise<DoubtRecord>;
  fail(doubtId: string, message: string): Promise<void>;
  saveFeedback(userId: string, doubtId: string, helpful: boolean): Promise<boolean>;
}

export type QueueJobOptions = {
  jobId: string;
  attempts: number;
  backoff: { type: 'exponential'; delay: number };
};

export interface DoubtQueue {
  add(name: 'resolve', data: { doubtId: string }, options: QueueJobOptions): Promise<unknown>;
}

export type UploadObject = { bytes: Buffer; contentType: string; contentLength: number };
export interface PrivateObjectStorage {
  presignPut(userId: string, contentType: string, contentLength: number, publicEndpoint?: string): Promise<{ imageKey: string; uploadUrl: string; expiresIn: number }>;
  getImage(userId: string, imageKey: string): Promise<UploadObject>;
  deleteUserObjects(userId: string): Promise<void>;
}

export type LLMMessage = { role: 'user' | 'assistant'; content: string };
export interface LLMProvider {
  generate(input: {
    systemPrompt: string;
    messages: LLMMessage[];
    image?: { mimeType: string; bytes: Buffer };
  }): Promise<string>;
}
