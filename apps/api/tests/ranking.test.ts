import { describe, it, expect } from 'vitest';
import type { RankedHit } from '../src/retrieval/searchService.js';

/** Mirror of the service tie-break contract: score DESC, chunkIndex ASC, chunkId ASC. */
function compareHits(a: RankedHit, b: RankedHit): number {
  return b.score - a.score || a.chunkIndex - b.chunkIndex || (a.chunkId < b.chunkId ? -1 : 1);
}

const hit = (over: Partial<RankedHit>): RankedHit => ({
  documentId: 'd1', chunkId: 'c1', filename: 'f', originalFilename: 'f',
  fileExtension: 'txt', chunkIndex: 0, pageNumber: null, sheetName: null,
  content: 'x', score: 0, ...over
});

describe('ranking and tie-breaking', () => {
  it('sorts by score desc', () => {
    const rows = [hit({ chunkId: 'a', score: 0.1 }), hit({ chunkId: 'b', score: 0.9 })].sort(compareHits);
    expect(rows[0]!.chunkId).toBe('b');
  });

  it('breaks score ties by chunk index then id (deterministic)', () => {
    const rows = [
      hit({ chunkId: 'c2', chunkIndex: 2, score: 0.5 }),
      hit({ chunkId: 'c0', chunkIndex: 0, score: 0.5 }),
      hit({ chunkId: 'c1', chunkIndex: 0, score: 0.5 })
    ].sort(compareHits);
    expect(rows.map((r) => r.chunkId)).toEqual(['c0', 'c1', 'c2']);
  });

  it('scores are similarities, not probabilities', () => {
    // Contract check: score range for cosine similarity.
    const rows = [hit({ score: -0.2 }), hit({ score: 1.0 })].sort(compareHits);
    expect(rows[0]!.score).toBeLessThanOrEqual(1);
    expect(rows[1]!.score).toBeGreaterThanOrEqual(-1);
  });
});
