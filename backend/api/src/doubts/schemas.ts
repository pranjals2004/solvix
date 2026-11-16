import { z } from 'zod';

export const createDoubtSchema = z.object({
  questionId: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(4000).optional(),
  imageKey: z.string().min(3).max(512).optional(),
}).strict().refine((value) => Boolean(value.text || value.imageKey), 'A text question or image is required.');

export const presignSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  contentLength: z.number().int().positive().max(5 * 1024 * 1024),
}).strict();

export const followupSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  messageId: z.string().uuid().optional(),
}).strict();

export const feedbackSchema = z.object({ helpful: z.boolean() }).strict();
