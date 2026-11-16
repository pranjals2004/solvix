const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_OVERLAP = 150;

export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP,
): string[] {
  if (!Number.isInteger(chunkSize) || chunkSize < 100) {
    throw new RangeError('chunkSize must be an integer of at least 100 characters.');
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= chunkSize) {
    throw new RangeError('overlap must be a non-negative integer smaller than chunkSize.');
  }

  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(' ', end);
      if (boundary > start + Math.floor(chunkSize * 0.7)) end = boundary;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;

    const nextStart = Math.max(0, end - overlap);
    const whitespace = normalized.indexOf(' ', nextStart);
    start = whitespace > nextStart && whitespace < end ? whitespace + 1 : nextStart;
  }
  return chunks;
}
