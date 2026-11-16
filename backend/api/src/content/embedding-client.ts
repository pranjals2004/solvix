import { z } from 'zod';
import { HttpError } from '../http/errors';

const EMBEDDING_DIMENSIONS = 384;
const MAX_BATCH_SIZE = 32;
const responseSchema = z.object({
  dimensions: z.literal(EMBEDDING_DIMENSIONS),
  embeddings: z.array(z.array(z.number()).length(EMBEDDING_DIMENSIONS)),
});

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export class MlServiceEmbeddingClient implements EmbeddingProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 30_000,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += MAX_BATCH_SIZE) {
      const batch = texts.slice(offset, offset + MAX_BATCH_SIZE);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/embed`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ texts: batch }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new HttpError(502, 'EMBEDDING_FAILED', 'The embedding service could not process this content.');
        }
        const parsed = responseSchema.safeParse(await response.json());
        if (!parsed.success || parsed.data.embeddings.length !== batch.length) {
          throw new HttpError(502, 'EMBEDDING_FAILED', 'The embedding service returned an invalid response.');
        }
        vectors.push(...parsed.data.embeddings);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(503, 'ML_SERVICE_UNAVAILABLE', 'The embedding service is unavailable.');
      } finally {
        clearTimeout(timeout);
      }
    }
    return vectors;
  }
}
