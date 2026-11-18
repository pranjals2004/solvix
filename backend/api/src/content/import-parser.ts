import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { noteInputSchema, questionInputSchema, uuidSchema } from './schemas';
import type { ContentService } from './service';
import type { NoteInput, QuestionInput } from './types';
import { HttpError } from '../http/errors';

const importBodySchema = z.object({
  questions: z.array(z.unknown()).max(100).default([]),
  notes: z.array(z.unknown()).max(100).default([]),
  questionsCsv: z.string().max(800_000).optional(),
  notesCsv: z.string().max(800_000).optional(),
}).strict();

const questionCsvColumns = [
  'id', 'subjectSlug', 'topicSlug', 'type', 'statementLatex', 'optionsJson',
  'correctAnswerJson', 'natTolerance', 'solutionLatex', 'isPyq', 'pyqYear', 'difficultyRating',
];
const noteCsvColumns = ['id', 'subjectSlug', 'topicSlug', 'title', 'content'];

type CsvRow = Record<string, string>;

export async function parseImportBody(
  body: unknown,
  content: ContentService,
): Promise<{ questions: Array<{ id?: string; input: QuestionInput }>; notes: Array<{ id?: string; input: NoteInput }> }> {
  const parsedBody = importBodySchema.safeParse(body);
  if (!parsedBody.success) {
    throw new HttpError(400, 'INVALID_IMPORT', 'Provide at most 100 questions and notes per format.');
  }

  const questions = parsedBody.data.questions.map((value) => {
    const record = parseJsonRecord(value, questionImportSchema);
    const { id, ...input } = record;
    return { ...(id ? { id } : {}), input };
  });
  const notes = parsedBody.data.notes.map((value) => {
    const record = parseJsonRecord(value, noteImportSchema);
    const { id, ...input } = record;
    return { ...(id ? { id } : {}), input };
  });

  if (parsedBody.data.questionsCsv) {
    const rows = parseCsvRows(parsedBody.data.questionsCsv, questionCsvColumns);
    for (const [index, row] of rows.entries()) {
      const topic = await content.findTopicBySlugs(row.subjectSlug ?? '', row.topicSlug ?? '');
      if (!topic) throw new HttpError(400, 'INVALID_IMPORT', `Question CSV row ${index + 2} references an unknown subject or topic slug.`);
      const rawQuestion = {
        subjectId: topic.subjectId,
        topicId: topic.id,
        type: row.type,
        statementLatex: row.statementLatex,
        optionsJson: parseJsonCell(row.optionsJson || '[]', 'optionsJson'),
        correctAnswerJson: parseJsonCell(row.correctAnswerJson ?? '', 'correctAnswerJson'),
        natTolerance: parseOptionalNumber(row.natTolerance, 'natTolerance'),
        solutionLatex: row.solutionLatex,
        isPyq: parseBoolean(row.isPyq, 'isPyq'),
        pyqYear: parseOptionalNumber(row.pyqYear, 'pyqYear'),
        difficultyRating: row.difficultyRating ? parseRequiredNumber(row.difficultyRating, 'difficultyRating') : 1000,
      };
      questions.push({
        ...(row.id ? { id: parseId(row.id) } : {}),
        input: parseJsonRecord(rawQuestion, questionInputSchema),
      });
    }
  }

  if (parsedBody.data.notesCsv) {
    const rows = parseCsvRows(parsedBody.data.notesCsv, noteCsvColumns);
    for (const [index, row] of rows.entries()) {
      const topic = await content.findTopicBySlugs(row.subjectSlug ?? '', row.topicSlug ?? '');
      if (!topic) throw new HttpError(400, 'INVALID_IMPORT', `Notes CSV row ${index + 2} references an unknown subject or topic slug.`);
      notes.push({
        ...(row.id ? { id: parseId(row.id) } : {}),
        input: parseJsonRecord({
          subjectId: topic.subjectId,
          topicId: topic.id,
          title: row.title,
          content: row.content,
        }, noteInputSchema),
      });
    }
  }

  if (questions.length > 100 || notes.length > 100 || (questions.length === 0 && notes.length === 0)) {
    throw new HttpError(400, 'INVALID_IMPORT', 'Import between 1 and 100 questions and/or notes per request.');
  }
  return { questions, notes };
}

function parseJsonRecord<T extends z.ZodType>(value: unknown, schema: T): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(400, 'INVALID_IMPORT', 'One or more import records do not match the content template.');
  }
  return result.data;
}

const questionImportSchema = z.object({
  id: uuidSchema.optional(),
  subjectId: uuidSchema,
  topicId: uuidSchema,
  type: z.enum(['mcq', 'msq', 'nat', 'short']),
  statementLatex: z.string().trim().min(1).max(20_000),
  optionsJson: z.array(z.string().max(5000)).max(20).default([]),
  correctAnswerJson: z.union([
    z.string().max(5000), z.number().finite(), z.array(z.string().max(100)).max(20), z.record(z.string(), z.unknown()),
  ]),
  natTolerance: z.number().finite().nonnegative().nullable().default(null),
  solutionLatex: z.string().trim().min(1).max(30_000),
  isPyq: z.boolean().default(false),
  pyqYear: z.number().int().min(1980).max(2100).nullable().default(null),
  difficultyRating: z.number().int().min(100).max(3000).default(1000),
}).strict().superRefine((question, context) => {
  if (question.isPyq !== (question.pyqYear !== null)) {
    context.addIssue({ code: 'custom', path: ['pyqYear'], message: 'PYQs require a year.' });
  }
});

const noteImportSchema = z.object({
  id: uuidSchema.optional(),
  subjectId: uuidSchema,
  topicId: uuidSchema,
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(100_000),
}).strict();

function parseCsvRows(csv: string, allowedColumns: string[]): CsvRow[] {
  let rows: unknown;
  try {
    rows = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      max_record_size: 200_000,
    });
  } catch {
    throw new HttpError(400, 'INVALID_IMPORT', 'CSV content is malformed.');
  }
  if (!Array.isArray(rows) || rows.length > 100) {
    throw new HttpError(400, 'INVALID_IMPORT', 'CSV imports are limited to 100 rows.');
  }
  for (const row of rows as CsvRow[]) {
    if (Object.keys(row).some((column) => !allowedColumns.includes(column))) {
      throw new HttpError(400, 'INVALID_IMPORT', 'CSV contains an unsupported column.');
    }
  }
  return rows as CsvRow[];
}

function parseJsonCell(value: string, fieldName: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new HttpError(400, 'INVALID_IMPORT', `CSV field ${fieldName} must contain valid JSON.`);
  }
}

function parseBoolean(value: string | undefined, fieldName: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new HttpError(400, 'INVALID_IMPORT', `CSV field ${fieldName} must be true or false.`);
}

function parseOptionalNumber(value: string | undefined, fieldName: string): number | null {
  if (!value) return null;
  return parseRequiredNumber(value, fieldName);
}

function parseRequiredNumber(value: string, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new HttpError(400, 'INVALID_IMPORT', `CSV field ${fieldName} must be numeric.`);
  return parsed;
}

function parseId(value: string): string {
  const result = uuidSchema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'INVALID_IMPORT', 'Imported IDs must be UUIDs.');
  return result.data;
}
