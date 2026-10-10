# DocuMind — Document Intelligence & Ingestion Platform

Standalone portfolio project: upload PDF/DOCX/TXT/CSV/XLSX → validate → extract → normalize → chunk → embed → persist (Postgres) → ranked semantic search. No paid API required to run locally (deterministic mock embeddings default).

> Frontend (`apps/web`, React + Vite + TypeScript) implements the Stitch reference in `frontend-design/*.png`: Documents library, Processing Queue, Chunk Explorer, Embeddings inspector, Semantic Search, plus Overview and Settings.

## Run locally (no paid API)

Prereqs: Node 20+, npm, local PostgreSQL 14+.

```zsh
# 1. Database
createdb documind  # once; uses DATABASE_URL in .env

# 2. Install + migrate + test
cp .env.example .env
npm install
npm run migrate -w apps/api
npm run test:api

# 3. Serve (two terminals)
npm run dev:api    # :4000
npm run dev:web    # :5173, proxies /api → :4000
# app: http://localhost:5173  ·  health: curl localhost:4000/api/health
```

Upload example:

```zsh
curl -F "files=@handbook.txt" localhost:4000/api/documents
curl -X POST localhost:4000/api/search -H 'Content-Type: application/json' \
  -d '{"query":"annual leave policy","topK":5}'
```

## Embeddings

- Default `EMBEDDING_PROVIDER=mock` (128-dim deterministic hash-bag, L2-normalized). It tests pipeline/persistence/ranking only — **it is not semantic search**.
- Gemini: set `EMBEDDING_PROVIDER=gemini`, `GEMINI_API_KEY`, verify a current **embedding** model (default `text-embedding-004`, 768 dims) + quota in official docs first. Generation models are not embedding models. Keys stay on the backend. Switching models needs a new vector column (dims cannot mix in one pgvector column) — see `docs/architecture/schema.md`.

## pgvector (optional upgrade)

Core works without it (JSONB vectors + exact brute-force cosine). After `CREATE EXTENSION vector` is verified, run migrate again to apply `002_pgvector.sql` (`vector(128)` for mock; HNSW only after exact search is correct).

## Structure

`apps/api/src/{routes,services,documents/{parsers,normalization,chunking},embeddings,retrieval,repositories,database/migrations}` · `apps/web/src/{api,pages,components}` (typed client in `api/client.ts`, no keys in browser, no processing logic in components) · `docs/{architecture,decisions,api}` · `scripts/` · `storage/` (gitignored uploads).

## Frontend honesty notes (vs the Stitch mockups)

- The mockups show OpenAI `text-embedding-3-small · 1536d`, worker threads, and per-stage percentages. This project forbids OpenAI and runs a synchronous pipeline, so the UI renders only real API data: the model badge shows the actual `embedding_provider/model/dim` from indexed docs, queue stages derive from real statuses, and there are no fabricated latencies (search shows client-measured round-trip only).
- Min-score is a labelled client-side filter; query-term highlights are keyword matches, not semantic explanations; chunk overlap shading is derived from real neighbour text.

## Test

`npm run test:api` — unit (validation, parsers, normalizer, chunker, mock embeddings, ranking) + DB-gated integration (upload→search→delete, retry, search filters). Retrieval eval: `npm run eval -w apps/api` (10 hand-labelled queries; P@K/R@K/MRR). `npm run test:web` — API client error mapping + base-URL resolution (5 tests).

## Limits

10 MB/file, 5 files/request, ext+MIME+signature gates, safe uuid filenames, no path traversal, rate-limited `/api/`, errors never leak stack traces. Auth/teams/billing/chat explicitly out of MVP scope.
