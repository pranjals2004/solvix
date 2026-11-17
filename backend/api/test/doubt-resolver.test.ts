import { describe, expect, it, vi } from 'vitest';
import { DoubtResolver } from '../src/doubts/resolver';
import { MockLLMProvider } from '../src/doubts/llm-provider';
import type { DoubtRecord, DoubtRepository, LLMProvider, PrivateObjectStorage, RetrievalContext } from '../src/doubts/types';

const context: RetrievalContext = {
  questionId: 'question-1',
  questionStatement: 'Find the recurrence depth.',
  questionSolution: 'The recurrence halves the input at each level.',
  topicId: 'topic-1',
  chunks: [1, 2, 3].map((index) => ({
    id: `chunk-${index}`, title: `Topic note ${index}`, content: `Retrieval evidence ${index}`,
    sourceType: 'note' as const, sourceId: `note-${index}`, topicId: 'topic-1', similarity: 0.9,
  })),
};

function fixture() {
  const doubt: DoubtRecord = {
    id: 'doubt-1', userId: 'user-1', questionId: 'question-1', text: 'I divided by two here.',
    imageKey: 'user-1/work.png', status: 'pending', conversation: [
      { id: 'm1', role: 'user', text: 'I divided by two here.', createdAt: new Date().toISOString() },
      { id: 'a1', role: 'assistant', text: 'Check the recurrence definition.', createdAt: new Date().toISOString() },
      { id: 'm2', role: 'user', text: 'Here is the line I wrote.', createdAt: new Date().toISOString() },
    ], aiResponse: null, retrievalContext: null, error: null, createdAt: new Date(), completedAt: null,
  };
  const repo = {
    async getById() { return doubt; },
    async setProcessing() { doubt.status = 'processing'; },
    async getRetrievalContext(_id: string, embedding: number[]) {
      expect(embedding).toHaveLength(384);
      return context;
    },
    async complete(_id: string, answer: string, resultContext: RetrievalContext) {
      doubt.status = 'done'; doubt.aiResponse = answer; doubt.retrievalContext = resultContext;
      return doubt;
    },
    async fail() {},
  } as unknown as DoubtRepository;
  const llm: LLMProvider = { generate: vi.fn(async () => 'Check the recurrence at each level. Diagnostic question: What shrinks on each step?') };
  const storage: PrivateObjectStorage = {
    async presignPut() { return { imageKey: '', uploadUrl: '', expiresIn: 300 }; },
    getImage: vi.fn(async (owner: string, key: string) => {
      expect(owner).toBe('user-1'); expect(key).toBe('user-1/work.png');
      return { bytes: Buffer.from('fake image'), contentType: 'image/png', contentLength: 10 };
    }),
    async deleteUserObjects() {},
  };
  const events: unknown[] = [];
  const emitter = { emitToUser: (_userId: string, _event: 'doubt:updated', payload: unknown) => events.push(payload) };
  const embeddings = { embed: vi.fn(async (texts: string[]) => {
    expect(texts[0]).toContain('Here is the line I wrote.');
    return [Array.from({ length: 384 }, () => 0.25)];
  }) };
  return { doubt, repo, llm, storage, emitter, embeddings, events };
}

describe('doubt resolver', () => {
  it('uses top-three retrieved context, attached work and complete conversation history', async () => {
    const { doubt, repo, llm, storage, emitter, embeddings, events } = fixture();
    const resolver = new DoubtResolver(repo, embeddings, llm, storage, emitter);
    await resolver.resolve(doubt.id);
    expect(embeddings.embed).toHaveBeenCalledOnce();
    expect(storage.getImage).toHaveBeenCalledOnce();
    const input = vi.mocked(llm.generate).mock.calls[0]?.[0];
    expect(input?.messages).toHaveLength(3);
    expect(input?.messages.map((message) => message.content)).toContain('Check the recurrence definition.');
    expect(input?.systemPrompt).toContain('Retrieval evidence 3');
    expect(input?.image?.mimeType).toBe('image/png');
    expect(events).toHaveLength(2);
    expect(doubt.status).toBe('done');
  });

  it('returns a deterministic mock tutor answer ending in one diagnostic question', async () => {
    const answer = await new MockLLMProvider().generate({ systemPrompt: 'GATE CS', messages: [{ role: 'user', content: 'Help' }] });
    expect(answer).toBe(await new MockLLMProvider().generate({ systemPrompt: 'anything', messages: [] }));
    expect((answer.match(/\?/g) ?? [])).toHaveLength(1);
    expect(answer.trim().endsWith('?')).toBe(true);
  });
});
