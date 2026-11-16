import type { DoubtClusterInput } from './types';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export function anonymizeDoubt(input: DoubtClusterInput): string {
  let text = input.text.replace(EMAIL_PATTERN, '[redacted email]');
  if (input.email.trim()) {
    text = text.replace(new RegExp(escapeRegExp(input.email.trim()), 'gi'), '[redacted email]');
  }
  const name = input.name?.trim();
  if (name) {
    text = text.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, 'giu'),
      '[redacted name]',
    );
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, 4_000);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
