import { Router } from 'express';
import type { ZodType } from 'zod';
import type { AppConfig } from '../config/env';
import type { RedisService } from '../infra/redis';
import { asyncRoute } from '../http/async-route';
import { createRequireAuth } from '../http/auth';
import { requireRole } from '../http/access-control';
import { HttpError } from '../http/errors';
import { parseImportBody } from './import-parser';
import {
  noteInputSchema,
  questionInputSchema,
  questionQuerySchema,
  subjectInputSchema,
  subjectUpdateSchema,
  topicIdQuerySchema,
  topicInputSchema,
  topicUpdateSchema,
  uuidSchema,
} from './schemas';
import type { ContentService } from './service';

export function createContentRouter(
  content: ContentService,
  redis: RedisService,
  config: AppConfig,
): Router {
  const router = Router();

  router.get('/subjects', asyncRoute(async (_request, response) => {
    response.json({ subjects: await content.listSubjects() });
  }));

  router.get('/subjects/:subjectId/topics', asyncRoute(async (request, response) => {
    const subjectId = parseValue(uuidSchema, request.params.subjectId, 'Invalid subject ID.');
    response.json({ topics: await content.listTopics(subjectId) });
  }));

  router.get('/questions', asyncRoute(async (request, response) => {
    const filters = parseValue(questionQuerySchema, request.query, 'Question filters are invalid.');
    response.json({ questions: await content.listQuestions(filters) });
  }));

  router.get('/questions/:questionId', asyncRoute(async (request, response) => {
    const id = parseValue(uuidSchema, request.params.questionId, 'Invalid question ID.');
    const question = await content.getPublicQuestion(id);
    if (!question) throw new HttpError(404, 'NOT_FOUND', 'Question not found.');
    response.json({ question });
  }));

  router.get('/notes', asyncRoute(async (request, response) => {
    const query = parseValue(topicIdQuerySchema, request.query, 'A valid topicId is required.');
    response.json({ notes: await content.listNotes(query.topicId) });
  }));

  const admin = Router();
  admin.use(createRequireAuth(redis, config), requireRole('admin'));

  admin.get('/questions', asyncRoute(async (request, response) => {
    const filters = parseValue(questionQuerySchema, request.query, 'Question filters are invalid.');
    response.json({ questions: await content.listAdminQuestions(filters) });
  }));
  admin.get('/questions/:questionId', asyncRoute(async (request, response) => {
    const id = parseValue(uuidSchema, request.params.questionId, 'Invalid question ID.');
    const question = await content.getAdminQuestion(id);
    if (!question) throw new HttpError(404, 'NOT_FOUND', 'Question not found.');
    response.json({ question });
  }));

  admin.post('/subjects', asyncRoute(async (request, response) => {
    const input = parseValue(subjectInputSchema, request.body, 'Subject content is invalid.');
    response.status(201).json({ subject: await content.createSubject(input) });
  }));
  admin.patch('/subjects/:subjectId', asyncRoute(async (request, response) => {
    const id = parseValue(uuidSchema, request.params.subjectId, 'Invalid subject ID.');
    const input = parseValue(subjectUpdateSchema, request.body, 'Subject content is invalid.');
    const subject = await content.updateSubject(id, input);
    if (!subject) throw new HttpError(404, 'NOT_FOUND', 'Subject not found.');
    response.json({ subject });
  }));
  admin.delete('/subjects/:subjectId', asyncRoute(async (request, response) => {
    const id = parseValue(uuidSchema, request.params.subjectId, 'Invalid subject ID.');
    if (!await content.deleteSubject(id)) throw new HttpError(404, 'NOT_FOUND', 'Subject not found.');
    response.status(204).end();
  }));

  admin.post('/subjects/:subjectId/topics', asyncRoute(async (request, response) => {
    const subjectId = parseValue(uuidSchema, request.params.subjectId, 'Invalid subject ID.');
    const input = parseValue(topicInputSchema, request.body, 'Topic content is invalid.');
    response.status(201).json({ topic: await content.createTopic({ ...input, subjectId }) });
  }));
  admin.patch('/topics/:topicId', asyncRoute(async (request, response) => {
    const id = parseValue(uuidSchema, request.params.topicId, 'Invalid topic ID.');
    const input = parseValue(topicUpdateSchema, request.body, 'Topic content is invalid.');
    const topic = await content.updateTopic(id, input);
    if (!topic) throw new HttpError(404, 'NOT_FOUND', 'Topic not found.');
    response.json({ topic });
  }));
  admin.delete('/topics/:topicId', asyncRoute(async (request, response) => {
    const id = parseValue(uuidSchema, request.params.topicId, 'Invalid topic ID.');
    if (!await content.deleteTopic(id)) throw new HttpError(404, 'NOT_FOUND', 'Topic not found.');
    response.status(204).end();
  }));

  admin.post('/questions', asyncRoute(async (request, response) => {
    const input = parseValue(questionInputSchema, request.body, 'Question content is invalid.');
    const question = await content.saveQuestion(undefined, input);
    if (!question) throw new Error('Question creation returned no record.');
    response.status(201).json({ question });
  }));
  admin.patch('/questions/:questionId', asyncRoute(async (request, response) => {
    const id = parseValue(uuidSchema, request.params.questionId, 'Invalid question ID.');
    const input = parseValue(questionInputSchema, request.body, 'Question content is invalid.');
    const question = await content.saveQuestion(id, input);
    if (!question) throw new HttpError(404, 'NOT_FOUND', 'Question not found.');
    response.json({ question });
  }));
  admin.delete('/questions/:questionId', asyncRoute(async (request, response) => {
    const id = parseValue(uuidSchema, request.params.questionId, 'Invalid question ID.');
    if (!await content.deleteQuestion(id)) throw new HttpError(404, 'NOT_FOUND', 'Question not found.');
    response.status(204).end();
  }));

  admin.post('/notes', asyncRoute(async (request, response) => {
    const input = parseValue(noteInputSchema, request.body, 'Note content is invalid.');
    const note = await content.saveNote(undefined, input);
    if (!note) throw new Error('Note creation returned no record.');
    response.status(201).json({ note });
  }));
  admin.patch('/notes/:noteId', asyncRoute(async (request, response) => {
    const id = parseValue(uuidSchema, request.params.noteId, 'Invalid note ID.');
    const input = parseValue(noteInputSchema, request.body, 'Note content is invalid.');
    const note = await content.saveNote(id, input);
    if (!note) throw new HttpError(404, 'NOT_FOUND', 'Note not found.');
    response.json({ note });
  }));
  admin.delete('/notes/:noteId', asyncRoute(async (request, response) => {
    const id = parseValue(uuidSchema, request.params.noteId, 'Invalid note ID.');
    if (!await content.deleteNote(id)) throw new HttpError(404, 'NOT_FOUND', 'Note not found.');
    response.status(204).end();
  }));

  admin.post('/import', asyncRoute(async (request, response) => {
    const records = await parseImportBody(request.body, content);
    const result = await content.importContent(records.questions, records.notes);
    response.status(201).json({ imported: result });
  }));

  router.use('/admin', admin);
  return router;
}

function parseValue<T>(schema: ZodType<T>, value: unknown, message: string): T {
  try {
    return schema.parse(value);
  } catch {
    throw new HttpError(400, 'INVALID_REQUEST', message);
  }
}
