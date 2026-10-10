export interface ChunkOptions {
  /** Target chunk size in words (baseline). ~800 tokens ≈ 600 words. */
  targetWords?: number;
  /** Overlap in words between consecutive chunks. */
  overlapWords?: number;
  /** Drop trailing chunk shorter than this if it can merge back. */
  minChunkWords?: number;
}

export interface TextChunk {
  index: number;
  content: string;
  wordCount: number;
  /** Estimated tokens ≈ words * 1.33, documented estimate (not a real tokenizer). */
  tokenEstimate: number;
  charStart: number;
  charEnd: number;
}

const DEFAULTS = { targetWords: 600, overlapWords: 90, minChunkWords: 40 } as const;

/**
 * Word-based overlapping chunker with paragraph awareness.
 * - Splits on blank lines first (paragraphs), then packs to target size.
 * - Overlap keeps context between neighbours; verified by tests.
 * - Deterministic, pure, no tokenizer dependency for MVP.
 */
export function chunkText(input: string, opts: ChunkOptions = {}): TextChunk[] {
  const { targetWords, overlapWords, minChunkWords } = { ...DEFAULTS, ...opts };
  if (!input.trim()) return [];

  const paragraphs = input.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const words: string[] = [];
  // Track paragraph boundaries so we prefer not to split mid-paragraph when small.
  const paraOfWord: number[] = [];
  paragraphs.forEach((para, pi) => {
    for (const w of para.split(' ')) {
      if (!w) continue;
      words.push(w);
      paraOfWord.push(pi);
    }
  });
  if (words.length === 0) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;
  // char offsets are approximate (joined by single spaces per paragraph) — document it.
  let charCursor = 0;

  while (start < words.length) {
    let end = Math.min(start + targetWords, words.length);
    // Merge tiny trailing chunk into previous one.
    if (end === words.length && words.length - start < minChunkWords && chunks.length > 0) {
      const prev = chunks[chunks.length - 1]!;
      const merged = `${prev.content} ${words.slice(start).join(' ')}`;
      const wc = merged.split(' ').length;
      chunks[chunks.length - 1] = {
        ...prev,
        content: merged,
        wordCount: wc,
        tokenEstimate: Math.ceil(wc * 1.33),
        charEnd: charCursor + merged.length
      };
      break;
    }
    const slice = words.slice(start, end);
    const content = slice.join(' ');
    chunks.push({
      index: index++,
      content,
      wordCount: slice.length,
      tokenEstimate: Math.ceil(slice.length * 1.33),
      charStart: charCursor,
      charEnd: charCursor + content.length
    });
    charCursor += content.length + 1;
    if (end === words.length) break;
    start = end - overlapWords;
    if (start < 0) start = 0;
  }
  return chunks;
}
