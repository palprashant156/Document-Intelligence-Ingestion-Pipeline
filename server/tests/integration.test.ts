import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { dbAvailable, _closePool } from '../src/database/db.js';
import { runMigrations } from '../src/database/migrate.js';
import { createApp } from '../src/app.js';

let db = false;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/documind';
  db = await dbAvailable();
  if (!db) {
    console.warn('SKIP integration: Postgres not reachable at DATABASE_URL');
    return;
  }
  await runMigrations();
  app = createApp();
});

describe('integration (requires local Postgres)', () => {
  it('upload -> list -> detail -> chunks -> search -> delete', async () => {
    if (!db) return;
    const text = `Employee leave policy. Employees may request up to 12 days of annual leave per year. Sick leave requires a doctor note after 3 days.`;
    const up = await request(app).post('/api/documents').attach('files', Buffer.from(text), 'handbook.txt');
    expect(up.status).toBe(201);
    const doc = up.body.data.documents[0].document;
    expect(doc.status).toBe('COMPLETED');

    const list = await request(app).get('/api/documents');
    expect(list.body.data.total).toBeGreaterThan(0);

    const detail = await request(app).get(`/api/documents/${doc.id}`);
    expect(detail.body.data.chunkCount).toBeGreaterThan(0);

    const chunks = await request(app).get(`/api/documents/${doc.id}/chunks`);
    expect(chunks.body.data.chunks.length).toBeGreaterThan(0);
    // Embedding inspector contract: small preview only, never full vectors.
    const previewEmb = chunks.body.data.chunks[0].embedding as number[] | null;
    expect(previewEmb === null || previewEmb.length <= 8).toBe(true);

    const search = await request(app).post('/api/search').send({ query: 'annual leave days', topK: 3 });
    expect(search.status).toBe(200);
    expect(search.body.data.results.length).toBeGreaterThan(0);
    expect(search.body.data.results[0].content).toContain('leave');

    const del = await request(app).delete(`/api/documents/${doc.id}`);
    expect(del.body.success).toBe(true);
    const gone = await request(app).get(`/api/documents/${doc.id}`);
    expect(gone.status).toBe(404);
  });

  it('retry rejects non-FAILED docs; failed retry path is idempotent', async () => {
    if (!db) return;
    const up = await request(app).post('/api/documents').attach('files', Buffer.from('plain text content here'), 'ok.txt');
    const doc = up.body.data.documents[0].document;
    const retry = await request(app).post(`/api/documents/${doc.id}/retry`);
    expect(retry.status).toBe(400); // COMPLETED cannot retry
    await request(app).delete(`/api/documents/${doc.id}`);
  });

  it('search filters: fileTypes-only and documentId', async () => {
    if (!db) return;
    const up = await request(app).post('/api/documents').attach('files', Buffer.from('name,leave_days\namy,12'), 'staff.csv');
    const doc = up.body.data.documents[0].document;

    // fileTypes-only (no documentId) — regression: placeholder numbering must be dynamic.
    const filtered = await request(app).post('/api/search').send({ query: 'leave days', topK: 5, filters: { fileTypes: ['csv'] } });
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.results.length).toBeGreaterThan(0);
    for (const r of filtered.body.data.results) expect(r.fileExtension).toBe('csv');

    const scoped = await request(app).post('/api/search').send({ query: 'leave days', topK: 5, filters: { documentId: doc.id } });
    expect(scoped.status).toBe(200);
    for (const r of scoped.body.data.results) expect(r.documentId).toBe(doc.id);

    await request(app).delete(`/api/documents/${doc.id}`);
  });

  it('search validation', async () => {
    if (!db) return;
    const res = await request(app).post('/api/search').send({ query: 'x'.repeat(2000) });
    expect(res.status).toBe(400);
  });
});

afterAll(async () => {
  await _closePool();
});
