import { env } from '../config/env.js';
import type { EmbeddingProvider } from './provider.js';
import { MockEmbeddingProvider } from './mockProvider.js';
import { GeminiEmbeddingProvider } from './geminiProvider.js';

let cached: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) return cached;
  if (env.EMBEDDING_PROVIDER === 'gemini') {
    cached = new GeminiEmbeddingProvider(env.GEMINI_API_KEY ?? '', env.GEMINI_EMBEDDING_MODEL);
  } else {
    cached = new MockEmbeddingProvider(env.MOCK_EMBEDDING_DIM);
  }
  return cached;
}

/** Test hook: reset singleton between tests. */
export function _resetProviderCache(): void {
  cached = null;
}
