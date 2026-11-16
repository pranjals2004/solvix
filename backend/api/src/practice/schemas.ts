import { z } from 'zod';
import { uuidSchema } from '../content/schemas';

const answerSchema = z.union([
  z.string().trim().min(1).max(5000),
  z.number().finite(),
  z.array(z.string().trim().min(1).max(100)).max(20),
  z.record(z.string(), z.unknown()),
]);

export const submissionInputSchema = z.object({
  questionId: uuidSchema,
  answer: answerSchema,
  timeTakenSec: z.number().int().min(0).max(86_400),
  confidence: z.number().int().min(1).max(5),
}).strict();
