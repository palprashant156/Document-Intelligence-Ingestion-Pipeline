-- 002_pgvector.sql — optional upgrade, run only after verifying extension.
-- Mock dim = 128. Gemini text-embedding-004 dim = 768.
-- Different dims CANNOT share one vector column: pgvector requires a fixed
-- dimension per column. Switching models => new column + backfill + swap.
-- This migration adds vector(128) for the mock provider. If you switch to
-- Gemini, create 003_gemini_768.sql with embedding_vec_768 vector(768).

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding_vec vector(128);

-- Backfill from JSONB where dims match (best-effort; mismatched rows stay NULL).
-- Run manually and verify counts; do not assume silent success.
-- UPDATE document_chunks SET embedding_vec = (embedding::text)::vector WHERE embedding IS NOT NULL;

-- HNSW index only AFTER basic exact queries are correct (Phase 8 guidance).
-- CREATE INDEX IF NOT EXISTS idx_chunks_hnsw ON document_chunks
--   USING hnsw (embedding_vec vector_cosine_ops) WITH (m = 16, ef_construction = 64);
