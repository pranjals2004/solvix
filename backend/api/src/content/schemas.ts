import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const slugSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const answerSchema = z.union([
  z.string().max(5000),
  z.number().finite(),
  z.array(z.string().max(100)).max(20),
  z.record(z.string(), z.unknown()),
]);

export const questionInputSchema = z.object({
  subjectId: uuidSchema,
  topicId: uuidSchema,
  type: z.enum(['mcq', 'msq', 'nat', 'short']),
  statementLatex: z.string().trim().min(1).max(20_000),
  optionsJson: z.array(z.string().max(5000)).max(20).default([]),
  correctAnswerJson: answerSchema,
  natTolerance: z.number().finite().nonnegative().nullable().default(null),
  solutionLatex: z.string().trim().min(1).max(30_000),
  isPyq: z.boolean().default(false),
  pyqYear: z.number().int().min(1980).max(2100).nullable().default(null),
  difficultyRating: z.number().int().min(100).max(3000).default(1000),
}).strict().superRefine((question, context) => {
  if (question.isPyq !== (question.pyqYear !== null)) {
    context.addIssue({
      code: 'custom',
      path: ['pyqYear'],
      message: 'PYQs require a year, while non-PYQs must not include one.',
    });
  }
});

export const questionImportSchema = questionInputSchema.extend({ id: uuidSchema.optional() });

export const noteInputSchema = z.object({
  subjectId: uuidSchema,
  topicId: uuidSchema,
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(100_000),
}).strict();

export const noteImportSchema = noteInputSchema.extend({ id: uuidSchema.optional() });

export const subjectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
}).strict();

export const subjectUpdateSchema = subjectInputSchema.partial().strict().refine(
  (input) => Object.keys(input).length > 0,
  'Provide at least one field to update.',
);

export const topicInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
}).strict();

export const topicUpdateSchema = topicInputSchema.partial().strict().refine(
  (input) => Object.keys(input).length > 0,
  'Provide at least one field to update.',
);

export const questionQuerySchema = z.object({
  subjectId: uuidSchema.optional(),
  topicId: uuidSchema.optional(),
  pyq: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  year: z.coerce.number().int().min(1980).max(2100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
}).strict();

export const topicIdQuerySchema = z.object({ topicId: uuidSchema }).strict();
