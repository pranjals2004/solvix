import { chunkText } from './chunker';
import type { EmbeddingProvider } from './embedding-client';
import type {
  AdminQuestion,
  ContentRepository,
  EmbeddedChunk,
  NoteInput,
  NoteRecord,
  PreparedNote,
  PreparedQuestion,
  PublicQuestion,
  QuestionFilters,
  QuestionInput,
  SubjectRecord,
  TopicRecord,
} from './types';
import { HttpError } from '../http/errors';

export class ContentService {
  constructor(
    private readonly repository: ContentRepository,
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  listSubjects(): Promise<SubjectRecord[]> { return this.repository.listSubjects(); }
  listTopics(subjectId: string): Promise<TopicRecord[]> { return this.repository.listTopics(subjectId); }
  listQuestions(filters: QuestionFilters): Promise<PublicQuestion[]> {
    return this.repository.listQuestions(filters);
  }
  listAdminQuestions(filters: QuestionFilters): Promise<AdminQuestion[]> {
    return this.repository.listAdminQuestions(filters);
  }
  getPublicQuestion(id: string): Promise<PublicQuestion | null> {
    return this.repository.getPublicQuestion(id);
  }
  getAdminQuestion(id: string): Promise<AdminQuestion | null> {
    return this.repository.getAdminQuestion(id);
  }
  listNotes(topicId: string): Promise<NoteRecord[]> { return this.repository.listNotes(topicId); }
  findTopicBySlugs(subjectSlug: string, topicSlug: string): Promise<TopicRecord | null> {
    return this.repository.findTopicBySlugs(subjectSlug, topicSlug);
  }

  createSubject(input: { name: string; slug: string }): Promise<SubjectRecord> {
    return this.repository.createSubject(input);
  }
  updateSubject(id: string, input: { name?: string; slug?: string }): Promise<SubjectRecord | null> {
    return this.repository.updateSubject(id, input);
  }
  deleteSubject(id: string): Promise<boolean> { return this.repository.deleteSubject(id); }
  createTopic(input: { subjectId: string; name: string; slug: string }): Promise<TopicRecord> {
    return this.repository.createTopic(input);
  }
  updateTopic(id: string, input: { name?: string; slug?: string }): Promise<TopicRecord | null> {
    return this.repository.updateTopic(id, input);
  }
  deleteTopic(id: string): Promise<boolean> { return this.repository.deleteTopic(id); }

  async saveQuestion(id: string | undefined, input: QuestionInput): Promise<AdminQuestion | null> {
    const chunks = await this.embedText(input.solutionLatex);
    return this.repository.saveQuestion(id, input, chunks);
  }

  deleteQuestion(id: string): Promise<boolean> { return this.repository.deleteQuestion(id); }

  async saveNote(id: string | undefined, input: NoteInput): Promise<NoteRecord | null> {
    const chunks = await this.embedText(input.content);
    return this.repository.saveNote(id, input, chunks);
  }

  deleteNote(id: string): Promise<boolean> { return this.repository.deleteNote(id); }

  async importContent(
    questions: Array<{ id?: string; input: QuestionInput }>,
    notes: Array<{ id?: string; input: NoteInput }>,
  ): Promise<{ questions: number; notes: number }> {
    const pendingQuestions = questions.map((item) => ({
      id: item.id,
      input: item.input,
      chunks: chunkText(item.input.solutionLatex),
    }));
    const pendingNotes = notes.map((item) => ({
      id: item.id,
      input: item.input,
      chunks: chunkText(item.input.content),
    }));
    const allTexts = [
      ...pendingQuestions.flatMap((item) => item.chunks),
      ...pendingNotes.flatMap((item) => item.chunks),
    ];
    const allVectors = await this.embeddingProvider.embed(allTexts);
    if (allVectors.length !== allTexts.length) {
      throw new HttpError(502, 'EMBEDDING_FAILED', 'The embedding service returned an invalid response.');
    }

    let vectorOffset = 0;
    const preparedQuestions: PreparedQuestion[] = pendingQuestions.map((item) => ({
      id: item.id,
      input: item.input,
      solutionChunks: item.chunks.map((content, chunkIndex) => ({
        content,
        chunkIndex,
        embedding: vectorAt(allVectors, vectorOffset++),
      })),
    }));
    const preparedNotes: PreparedNote[] = pendingNotes.map((item) => ({
      id: item.id,
      input: item.input,
      chunks: item.chunks.map((content, chunkIndex) => ({
        content,
        chunkIndex,
        embedding: vectorAt(allVectors, vectorOffset++),
      })),
    }));

    return this.repository.importContent(preparedQuestions, preparedNotes);
  }

  private async embedText(text: string): Promise<EmbeddedChunk[]> {
    const chunks = chunkText(text);
    const vectors = await this.embeddingProvider.embed(chunks);
    if (vectors.length !== chunks.length) {
      throw new HttpError(502, 'EMBEDDING_FAILED', 'The embedding service returned an invalid response.');
    }
    return chunks.map((content, chunkIndex) => ({
      content,
      chunkIndex,
      embedding: vectorAt(vectors, chunkIndex),
    }));
  }
}

function vectorAt(vectors: number[][], index: number): number[] {
  const vector = vectors[index];
  if (!vector) {
    throw new HttpError(502, 'EMBEDDING_FAILED', 'The embedding service returned an invalid response.');
  }
  return vector;
}
