import { describe, it, expect } from 'vitest';
import { normalizeText } from '../src/documents/normalization/normalizer.js';
import { chunkText } from '../src/documents/chunking/chunker.js';

describe('normalizer', () => {
  it('handles empty input', () => {
    expect(normalizeText('').text).toBe('');
    expect(normalizeText('   \n  ').warnings.length).toBeGreaterThan(0);
  });

  it('normalizes unicode + whitespace', () => {
    const { text } = normalizeText('Héllo   world\r\n\r\n\r\nnext\u00A0line');
    expect(text).toBe('Héllo world\n\nnext line');
  });

  it('strips control chars but keeps newlines', () => {
    const { text } = normalizeText('a\x00b\nc\x07d');
    expect(text).toBe('ab\ncd');
  });
});

describe('chunker', () => {
  it('returns [] for empty text', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('keeps one chunk for short docs', () => {
    const chunks = chunkText('hello world');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.index).toBe(0);
    expect(chunks[0]!.tokenEstimate).toBeGreaterThan(0);
  });

  it('splits long docs with overlap', () => {
    const words = Array.from({ length: 1000 }, (_, i) => `w${i}`);
    const chunks = chunkText(words.join(' '), { targetWords: 100, overlapWords: 20 });
    expect(chunks.length).toBeGreaterThan(5);
    // Overlap: last 20 words of chunk 0 == first 20 of chunk 1
    const c0 = chunks[0]!.content.split(' ');
    const c1 = chunks[1]!.content.split(' ');
    expect(c1.slice(0, 20)).toEqual(c0.slice(-20));
    // Ordered indexes
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });

  it('merges tiny trailing chunks', () => {
    const words = Array.from({ length: 115 }, (_, i) => `w${i}`).join(' ');
    const chunks = chunkText(words, { targetWords: 100, overlapWords: 10, minChunkWords: 40 });
    expect(chunks).toHaveLength(1);
  });
});
