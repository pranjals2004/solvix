import { describe, expect, it } from 'vitest';
import { gradeAnswer } from '../src/practice/grading';

describe('practice answer grading', () => {
  it('grades MCQ labels and the seed content selected-answer shape', () => {
    expect(gradeAnswer('mcq', 'a', { selected: 'A', syntheticPlaceholder: true }, null)).toBe(true);
    expect(gradeAnswer('mcq', 'B', { selected: 'A' }, null)).toBe(false);
  });

  it('grades MSQ answers without depending on selection order', () => {
    expect(gradeAnswer('msq', ['C', 'A'], ['A', 'C'], null)).toBe(true);
    expect(gradeAnswer('msq', ['A'], ['A', 'C'], null)).toBe(false);
  });

  it('applies the configured NAT tolerance and rejects non-numeric answers', () => {
    expect(gradeAnswer('nat', '3.14', Math.PI, 0.002)).toBe(true);
    expect(gradeAnswer('nat', '3.14', Math.PI, 0.0001)).toBe(false);
    expect(gradeAnswer('nat', '', 0, 0.1)).toBe(false);
  });
});
