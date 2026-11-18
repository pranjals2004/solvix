import type { QuestionType } from '../content/types';

export type SubmittedAnswer = string | number | string[] | Record<string, unknown>;

export function gradeAnswer(
  type: QuestionType,
  submitted: SubmittedAnswer,
  correct: unknown,
  natTolerance: number | null,
): boolean {
  if (type === 'nat') {
    const expectedNumber = numericAnswer(correct);
    const submittedNumber = numericAnswer(submitted);
    return expectedNumber !== null && submittedNumber !== null &&
      Math.abs(expectedNumber - submittedNumber) <= (natTolerance ?? 0);
  }

  if (type === 'msq') {
    const expectedValues = answerList(correct);
    const submittedValues = answerList(submitted);
    if (!expectedValues || !submittedValues) return false;
    return sameSet(expectedValues, submittedValues);
  }

  if (type === 'short') {
    const expectedText = shortAnswerText(correct);
    const submittedText = shortAnswerText(submitted);
    return expectedText !== null && submittedText !== null && expectedText === submittedText;
  }

  return answerText(submitted) !== null && answerText(submitted) === answerText(correct);
}

function shortAnswerText(value: unknown): string | null {
  const unwrapped = unwrapAnswer(value);
  if (typeof unwrapped !== 'string' || !unwrapped.trim()) return null;
  return unwrapped.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function answerList(value: unknown): string[] | null {
  const unwrapped = unwrapAnswer(value);
  if (!Array.isArray(unwrapped)) return null;
  return unwrapped.map((item) => typeof item === 'string' ? item.trim() : String(item));
}

function answerText(value: unknown): string | null {
  const unwrapped = unwrapAnswer(value);
  if (typeof unwrapped === 'string') return unwrapped.trim().toUpperCase();
  if (typeof unwrapped === 'number' && Number.isFinite(unwrapped)) return String(unwrapped);
  return null;
}

function unwrapAnswer(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if ('selected' in record) return record.selected;
  if ('answer' in record) return record.answer;
  if ('value' in record) return record.value;
  return value;
}

function numericAnswer(value: unknown): number | null {
  const unwrapped = unwrapAnswer(value);
  if (typeof unwrapped === 'number') return Number.isFinite(unwrapped) ? unwrapped : null;
  if (typeof unwrapped !== 'string' || !unwrapped.trim()) return null;
  const parsed = Number(unwrapped);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left.map((item) => item.toUpperCase()));
  const rightSet = new Set(right.map((item) => item.toUpperCase()));
  return leftSet.size === rightSet.size && [...leftSet].every((item) => rightSet.has(item));
}
