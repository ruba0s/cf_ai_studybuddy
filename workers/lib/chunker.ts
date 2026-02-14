// text chunking utility

export interface Chunk {
  id: string;
  text: string;
  index: number;
}

/**
 * Splits text into overlapping chunks suitable for question generation.
 * Target: ~500 tokens per chunk (rough heuristic: 1 token ≈ 4 chars)
 */
export function chunkText(text: string, chunkSize = 1800, overlap = 200): Chunk[] {
  const chunks: Chunk[] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  if (normalized.length <= chunkSize) {
    return [{ id: crypto.randomUUID(), text: normalized, index: 0 }];
  }

  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    let end = start + chunkSize;

    // Try to break at a paragraph or sentence boundary
    if (end < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf('\n\n', end);
      const sentenceBreak = normalized.lastIndexOf('. ', end);

      if (paragraphBreak > start + chunkSize / 2) {
        end = paragraphBreak;
      } else if (sentenceBreak > start + chunkSize / 2) {
        end = sentenceBreak + 1;
      }
    }

    chunks.push({
      id: crypto.randomUUID(),
      text: normalized.slice(start, end).trim(),
      index,
    });

    start = end - overlap;
    index++;
  }

  return chunks;
}