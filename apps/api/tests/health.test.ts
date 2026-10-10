import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('health', () => {
  it('GET /api/health returns ok', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('unknown route returns 404 envelope', async () => {
    const app = createApp();
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/search rejects empty query', async () => {
    const app = createApp();
    const res = await request(app).post('/api/search').send({ query: '' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
