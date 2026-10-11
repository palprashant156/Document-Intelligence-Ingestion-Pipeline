import type { EmbeddingProvider } from './provider.js';

/**
 * Gemini embedding provider.
 * Model MUST be an embedding model (default text-embedding-004, 768 dims).
 * Text-generation models (gemini-1.5-*, gemini-2.*) are NOT embedding models.
 * Verify model + free-tier quota in official docs before enabling.
 * Key stays on backend; never called from browser.
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'gemini';
  readonly dimensions = 768;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'text-embedding-004') {
    if (!apiKey) throw new Error('GEMINI_API_KEY is required for gemini provider');
    this.apiKey = apiKey;
    this.model = model;
  }

  async embed(text: string): Promise<number[]> {
    const batch = await this.embedBatch([text]);
    return batch[0]!;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    // Small batches to respect rate limits; retry once with backoff on 429/5xx.
    const BATCH = 8;
    for (let i = 0; i < texts.length; i += BATCH) {
      const slice = texts.slice(i, i + BATCH);
      out.push(...(await this.requestWithRetry(slice)));
    }
    return out;
  }

  private async requestWithRetry(texts: string[]): Promise<number[][]> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.request(texts);
      } catch (err) {
        lastErr = err;
        const msg = (err as Error).message;
        if (!/429|5\d\d|fetch|network/i.test(msg) || attempt === 2) break;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
    throw lastErr;
  }

  private async request(texts: string[]): Promise<number[][]> {
    // REST: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((t) => ({ model: `models/${this.model}`, content: { parts: [{ text: t.slice(0, 8000) }] } }))
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini embed failed ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { embeddings?: Array<{ values: number[] }> };
    if (!json.embeddings || json.embeddings.length !== texts.length) {
      throw new Error('Gemini embed returned unexpected shape');
    }
    return json.embeddings.map((e) => {
      if (e.values.length !== this.dimensions) {
        throw new Error(`Gemini dimension mismatch: got ${e.values.length}, expected ${this.dimensions}`);
      }
      return e.values;
    });
  }
}
