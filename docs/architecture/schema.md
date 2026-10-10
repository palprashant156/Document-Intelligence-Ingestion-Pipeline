# Database schema

## documents
id UUID PK, filename (safe stored name), original_filename (display only),
mime_type, file_extension (pdf/docx/txt/csv/xlsx), file_size_bytes (>0),
sha256 CHAR(64), storage_path, status (UPLOADED/PROCESSING/COMPLETED/FAILED),
page_count?, error_message?, embedding_provider/model/dim?, created_at, updated_at.
Indexes: status, created_at DESC.

## processing_jobs
id UUID PK, document_id FK → documents ON DELETE CASCADE, status
(PENDING/RUNNING/SUCCEEDED/FAILED), attempt_count, started_at, completed_at,
error_message?, created_at. Index: document_id.

## document_chunks
id UUID PK, document_id FK → documents ON DELETE CASCADE, chunk_index ≥0,
content, token_estimate? (≈ words×1.33, documented estimate), page_number?,
sheet_name?, chunk_metadata JSONB, embedding JSONB? (portable fallback),
embedding_vec vector(128)? (added by 002 when pgvector verified), created_at.
Constraints: UNIQUE(document_id, chunk_index) — makes retries idempotent.
Indexes: document_id; optional HNSW on embedding_vec after exact search is correct.

## Vector dimensions
- Mock provider: 128 dims (fixed, documented in `.env.example`).
- Gemini `text-embedding-004`: 768 dims.
- pgvector requires one fixed dim per column — models cannot mix in one column.
- Strategy: separate columns per model (`embedding_vec` 128 vs future `embedding_vec_768`),
  backfill + verify counts, then swap reads. Never silently truncate/pad vectors.
