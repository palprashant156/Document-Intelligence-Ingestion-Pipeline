# API

Base: `http://localhost:4000/api`. Envelope: `{ success: true, data }` or `{ success: false, error: { code, message, requestId } }`.

- `GET /health` → `{ status: 'ok', service, time }`
- `POST /documents` (multipart field `files`, ≤5 files, ≤10MB each) → `{ documents: [{ document, jobId, chunks }] }`
- `GET /documents?limit=&offset=` → `{ documents, total, limit, offset }`
- `GET /documents/:id` → `{ document, chunkCount, latestJob }`
- `DELETE /documents/:id` → `{ deleted: true }` (cascades chunks+jobs, unlinks file)
- `POST /documents/:id/retry` (only FAILED) → `{ document, jobId }`
- `GET /documents/:id/chunks?limit=&offset=` → chunk previews (first 8 vector values only)
- `GET /documents/:id/chunks/:chunkId` → full chunk + 16-value embedding preview
- `GET /jobs/:id` → `{ job }`
- `POST /search` `{ query, topK=5, filters?: { documentId?, fileTypes? } }` → `{ results: [{ documentId, chunkId, filename, chunkIndex, pageNumber, content, score }] }`
  - `score` = cosine **similarity** (higher = more similar), not a probability, not pgvector distance (distance = 1 − similarity).
