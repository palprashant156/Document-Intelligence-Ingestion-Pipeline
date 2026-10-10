import { getPool } from '../database/db.js';

export interface ChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  token_estimate: number | null;
  page_number: number | null;
  sheet_name: string | null;
  chunk_metadata: Record<string, unknown>;
  embedding: number[] | null;
  created_at: string;
}

export interface ChunkInsert {
  chunkIndex: number;
  content: string;
  tokenEstimate?: number;
  pageNumber?: number | null;
  sheetName?: string | null;
  metadata?: Record<string, unknown>;
  embedding?: number[] | null;
}

async function hasVectorColumn(): Promise<boolean> {
  try {
    const { rows } = await getPool().query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='document_chunks' AND column_name='embedding_vec'`
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Idempotent insert: retrying the same job must not duplicate chunks. */
export async function insertChunks(documentId: string, chunks: ChunkInsert[]): Promise<void> {
  if (chunks.length === 0) return;
  const pool = getPool();
  const useVec = await hasVectorColumn();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const c of chunks) {
      const embJson = c.embedding ? JSON.stringify(c.embedding) : null;
      if (useVec && c.embedding) {
        const literal = `[${c.embedding.join(',')}]`;
        await client.query(
          `INSERT INTO document_chunks (document_id, chunk_index, content, token_estimate, page_number, sheet_name, chunk_metadata, embedding, embedding_vec)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector)
           ON CONFLICT (document_id, chunk_index) DO UPDATE SET content=EXCLUDED.content, token_estimate=EXCLUDED.token_estimate,
             page_number=EXCLUDED.page_number, sheet_name=EXCLUDED.sheet_name, chunk_metadata=EXCLUDED.chunk_metadata,
             embedding=EXCLUDED.embedding, embedding_vec=EXCLUDED.embedding_vec`,
          [documentId, c.chunkIndex, c.content, c.tokenEstimate ?? null, c.pageNumber ?? null, c.sheetName ?? null, c.metadata ?? {}, embJson, literal]
        );
      } else {
        await client.query(
          `INSERT INTO document_chunks (document_id, chunk_index, content, token_estimate, page_number, sheet_name, chunk_metadata, embedding)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (document_id, chunk_index) DO UPDATE SET content=EXCLUDED.content, token_estimate=EXCLUDED.token_estimate,
             page_number=EXCLUDED.page_number, sheet_name=EXCLUDED.sheet_name, chunk_metadata=EXCLUDED.chunk_metadata, embedding=EXCLUDED.embedding`,
          [documentId, c.chunkIndex, c.content, c.tokenEstimate ?? null, c.pageNumber ?? null, c.sheetName ?? null, c.metadata ?? {}, embJson]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listChunks(documentId: string, limit = 50, offset = 0): Promise<ChunkRow[]> {
  const { rows } = await getPool().query(
    `SELECT id, document_id, chunk_index, content, token_estimate, page_number, sheet_name, chunk_metadata,
            CASE WHEN embedding IS NULL THEN NULL ELSE (embedding::text)::jsonb END AS embedding, created_at
     FROM document_chunks WHERE document_id=$1 ORDER BY chunk_index ASC LIMIT $2 OFFSET $3`,
    [documentId, limit, offset]
  );
  return rows.map((r: Record<string, unknown>) => ({
    ...(r as unknown as ChunkRow),
    embedding: r['embedding'] == null ? null : (typeof r['embedding'] === 'string' ? JSON.parse(r['embedding'] as string) : (r['embedding'] as number[]))
  }));
}

export async function getChunk(documentId: string, chunkId: string): Promise<ChunkRow | null> {
  const { rows } = await getPool().query(
    `SELECT id, document_id, chunk_index, content, token_estimate, page_number, sheet_name, chunk_metadata, embedding, created_at
     FROM document_chunks WHERE document_id=$1 AND id=$2`,
    [documentId, chunkId]
  );
  const r = rows[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    ...(r as unknown as ChunkRow),
    embedding: r['embedding'] == null ? null : (typeof r['embedding'] === 'string' ? JSON.parse(r['embedding'] as string) : (r['embedding'] as number[]))
  };
}

export async function countChunks(documentId: string): Promise<number> {
  const { rows } = await getPool().query(`SELECT COUNT(*)::int AS c FROM document_chunks WHERE document_id=$1`, [documentId]);
  return (rows[0] as { c: number }).c;
}
