# DocuMind — architecture overview

Modular monolith (Express + TypeScript strict). See `../../README.md` for the diagram.

## Modules

- `routes/` — HTTP mapping only.
- `controllers/` — merged into routes for MVP size (validation via Zod, then service calls). Split when a route file exceeds ~200 lines.
- `services/` — `uploadValidation.ts` (ext/MIME/signature gates), `ingestionService.ts` (parse → normalize → chunk → embed → persist → status).
- `documents/parsers/` — `DocumentParser` interface + 5 isolated parsers + `registry.ts`.
- `documents/normalization/` — pure `normalizeText`.
- `documents/chunking/` — pure word-based overlapping `chunkText`.
- `embeddings/` — `EmbeddingProvider` interface, `MockEmbeddingProvider` (default), `GeminiEmbeddingProvider` (verified model only).
- `repositories/` — only SQL lives here (`documentRepo`, `chunkRepo`, `jobRepo`).
- `retrieval/searchService.ts` — query embed → pgvector `<=>` when available, else exact brute-force cosine → deterministic ranking.
- `database/migrations/` — `001_init.sql` (portable, JSONB vectors), `002_pgvector.sql` (optional native `vector(128)` upgrade).

## Key flows

Upload: multipart → ext/MIME/signature → safe uuid filename → `documents(UPLOADED)` → `processing_jobs(PENDING)` → sync `processDocument` → `COMPLETED/FAILED`.
Search: `POST /api/search` → embed query → filtered similarity search → top-K ranked hits with similarity scores.
Retry: only `FAILED` docs; chunk insert is idempotent via `ON CONFLICT (document_id, chunk_index)`.
Delete: `ON DELETE CASCADE` removes chunks + jobs; stored file unlinked best-effort.
