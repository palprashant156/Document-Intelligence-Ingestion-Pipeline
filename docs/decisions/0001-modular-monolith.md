# ADR 0001 — Modular monolith, sync pipeline first, mock embeddings first

Date: 2026-10-09. Status: accepted.

## Context
Portfolio project, local-only, limited bandwidth, no paid APIs, must be interview-explainable.

## Decisions
1. Modular monolith over microservices: one deployable, module boundaries via folders + repository rule (only repos touch SQL).
2. Synchronous ingestion for MVP: upload handler awaits parse→chunk→embed→persist. Background queue only when uploads become slow (measured, not assumed).
3. Mock embeddings default; Gemini only after verifying a current embedding model + free-tier access from official docs. Generation models are not embedding models.
4. Postgres JSONB vectors first, pgvector `vector(128)` as opt-in upgrade (002). Keeps the app runnable before the extension is installed; exact search first, HNSW only after correctness.
5. No Docker/Auth/chat/analytics in MVP; ownership boundaries left open (document `id` scoping) for later auth.

## Consequences
- Must enforce idempotent chunk inserts and FAILED-only retries from day one.
- Must document that mock scores are deterministic plumbing checks, not semantic quality.
- Model switch requires a new vector column + migration, never silent mixing.
