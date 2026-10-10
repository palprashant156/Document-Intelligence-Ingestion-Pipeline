import { describe, it, expect } from 'vitest';
import { MockEmbeddingProvider } from '../src/embeddings/mockProvider.js';
import { cosineSimilarity, cosineDistance } from '../src/embeddings/provider.js';

describe('mock embeddings', () => {
  it('is deterministic with fixed dims', async () => {
    const p = new MockEmbeddingProvider(32);
    const a = await p.embed('hello world');
    const b = await p.embed('hello world');
    expect(a).toEqual(b);
    expect(a).toHaveLength(32);
  });

  it('outputs L2-normalized vectors', async () => {
    const p = new MockEmbeddingProvider(64);
    const v = await p.embed('some text here');
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('identical texts score 1, empty scores defined', async () => {
    const p = new MockEmbeddingProvider(32);
    const a = await p.embed('leave policy');
    const b = await p.embed('leave policy');
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
    expect(cosineDistance(a, b)).toBeCloseTo(0, 5);
  });

  it('throws on dimension mismatch (models cannot mix)', () => {
    expect(() => cosineSimilarity([1, 0], [1, 0, 0])).toThrow();
  });
});
