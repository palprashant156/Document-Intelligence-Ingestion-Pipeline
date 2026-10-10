import { createHash } from 'node:crypto';
import type { EmbeddingProvider } from './provider.js';

/**
 * Deterministic mock embeddings for pipeline/persistence/ranking tests.
 * NOT semantic: hashed token-bag projected to fixed dims + L2 normalized.
 * Related-vs-unrelated experiments with this provider prove nothing about
 * real semantics — documented limitation.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'mock';
  readonly dimensions: number;

  constructor(dimensions = 128) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    return this.embedSync(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedSync(t));
  }

  embedSync(text: string): number[] {
    const vec = new Array<number>(this.dimensions).fill(0);
    const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (tokens.length === 0) {
      // Deterministic non-zero fallback so cosine math stays defined.
      const h = createHash('sha256').update('empty').digest();
      for (let i = 0; i < this.dimensions; i++) vec[i] = (h[i % h.length]! / 255) * 2 - 1;
    } else {
      for (const tok of tokens) {
        const h = createHash('sha256').update(tok).digest();
        const idx = h.readUInt16BE(0) % this.dimensions;
        const sign = h[2]! % 2 === 0 ? 1 : -1;
        vec[idx]! += sign * (1 + (h[3]! / 255));
      }
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
