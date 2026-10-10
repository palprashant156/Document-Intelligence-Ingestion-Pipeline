# Benchmarks — local baseline (MacBook, CPU-only, mock embeddings)

Date: 2026-10-09. Dataset: tiny fixtures (90B–16KB), 6 chunks total, pgvector `vector(128)` active.

| Operation | Input | Observed |
|---|---|---|
| Upload + sync ingest (TXT 90B) | 1 file | ~25 ms |
| Upload + sync ingest (PDF 621B, XLSX 16KB, DOCX 886B, CSV 28B) | 1 file each | ~10–30 ms |
| `POST /api/search` topK 5 over 6 chunks | pgvector `<=>` | ~11 ms |
| `npm test` (34 unit + 3 integration) | full suite | < 1 s |
| Retrieval eval (10 queries, in-memory) | P@2 0.500, R@2 1.000, MRR 0.950 | mock plumbing only |

Method: `time curl …` client-measured, single run, warm server. Not production numbers.

## What would change at scale

- Embedding batching (8/batch for Gemini) and batched chunk inserts already implemented.
- HNSW index (`002_pgvector.sql` has it commented) only after exact-search correctness — current data is far too small to need it.
- Background jobs + bounded concurrency when uploads exceed ~seconds (measured, not assumed).
- 10 MB PDFs with hundreds of pages: parse streams page-by-page already; watch `pdfjs` memory, chunk count, and vector insert time.

## Known limitations

- Mock embeddings are NOT semantic (hashed token-bag). Eval numbers above validate plumbing/ranking determinism only.
- No OCR: scanned/image-only PDFs ingest as FAILED with a clear message.
- XLSX truncated at 50k cells per workbook (memory guard, reported as warning).
- Auth, teams, billing, chat explicitly out of scope (ownership scoping left open via `document_id` filters).
