import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { ApiError, resolveApiBase, listDocuments, search } from './client.js';

// Node env has no DOM localStorage — stub the tiny surface the client uses.
const memStore = new Map<string, string>();
beforeEach(() => {
  memStore.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memStore.get(k) ?? null,
    setItem: (k: string, v: string) => void memStore.set(k, v),
    removeItem: (k: string) => void memStore.delete(k),
    clear: () => memStore.clear()
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveApiBase', () => {
  it('defaults to same-origin /api', () => {
    expect(resolveApiBase()).toBe('/api');
  });

  it('prefers the Settings override from localStorage', () => {
    memStore.set('documind.apiBase', 'http://localhost:4000/api/');
    expect(resolveApiBase()).toBe('http://localhost:4000/api');
  });
});

describe('client error mapping', () => {
  it('maps API error envelopes to ApiError with code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 415,
        json: async () => ({ success: false, error: { code: 'UNSUPPORTED_FILE', message: 'nope' } })
      }))
    );
    await expect(listDocuments()).rejects.toMatchObject({ status: 415, code: 'UNSUPPORTED_FILE' });
  });

  it('maps non-JSON responses to BAD_RESPONSE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('not json');
        }
      }))
    );
    await expect(search('x', 5)).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('ApiError carries status + code', () => {
    const e = new ApiError(404, 'NOT_FOUND', 'gone');
    expect(e.status).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
  });
});
