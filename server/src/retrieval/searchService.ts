import { cosineSimilarity } from '../embeddings/provider.js';
import { getEmbeddingProvider } from '../embeddings/index.js';
import { getPool } from '../database/db.js';

export interface RankedHit {
  documentId: string;
  chunkId: string;
  filename: string;
  originalFilename: string;
  fileExtension: string;
  chunkIndex: number;
  pageNumber: number | null;
  sheetName: string | null;
  content: string;
  /** Cosine similarity in [-1,1] (higher = more similar). NOT a probability. */
  score: number;
}

export interface SearchOptions {
  topK: number;
  documentId?: string | null;
  fileTypes?: string[] | null;
}

/**
 * Retrieval: query -> embed -> similarity search -> rank.
 * - Prefers pgvector `<=>` when embedding_vec exists; else exact brute-force
 *   over JSONB embeddings in Node (correct on small data, no index needed).
 * - Deterministic tie-break: score DESC, chunk_index ASC, chunk id ASC.
 * - Filters applied in SQL (document, file type) before ranking.
 */
export async function searchChunks(query: string, opts: SearchOptions): Promise<RankedHit[]> {
  if (!query.trim()) return [];
  const provider = getEmbeddingProvider();
  const [qvec] = await provider.embedBatch([query]);
  const q = qvec!;
  const pool = getPool();

  const hasVec =
    (await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='document_chunks' AND column_name='embedding_vec'`)).rowCount! > 0;

  if (hasVec) {
    // pgvector cosine distance (<=>); score = 1 - distance.
    // Placeholders are numbered dynamically — filters are optional.
    const params: unknown[] = [`[${q.join(',')}]`];
    const conds: string[] = [];
    if (opts.documentId) {
      params.push(opts.documentId);
      conds.push(`AND c.document_id = $${params.length}`);
    }
    if (opts.fileTypes?.length) {
      params.push(opts.fileTypes);
      conds.push(`AND d.file_extension = ANY($${params.length})`);
    }
    const limit = opts.topK * 4; // over-fetch, then filter nulls + re-sort deterministically
    const { rows } = await pool.query(
      `SELECT c.id, c.document_id, c.chunk_index, c.content, c.page_number, c.sheet_name,
              d.original_filename, d.filename, d.file_extension,
              1 - (c.embedding_vec <=> $1::vector) AS score
       FROM document_chunks c JOIN documents d ON d.id = c.document_id
       WHERE c.embedding_vec IS NOT NULL AND d.status='COMPLETED' ${conds.join(' ')}
       ORDER BY c.embedding_vec <=> $1::vector ASC, c.chunk_index ASC, c.id ASC
       LIMIT ${Number(limit)}`,
      params
    );
    return (rows as Array<Record<string, unknown>>)
      .map((r) => toHit(r))
      .sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex || (a.chunkId < b.chunkId ? -1 : 1))
      .slice(0, opts.topK);
  }

  // Fallback: exact brute-force cosine in Node.
  const fbParams: unknown[] = [];
  const fbConds: string[] = [];
  if (opts.documentId) {
    fbParams.push(opts.documentId);
    fbConds.push(`AND c.document_id = $${fbParams.length}`);
  }
  if (opts.fileTypes?.length) {
    fbParams.push(opts.fileTypes);
    fbConds.push(`AND d.file_extension = ANY($${fbParams.length})`);
  }
  const { rows } = await pool.query(
    `SELECT c.id, c.document_id, c.chunk_index, c.content, c.page_number, c.sheet_name, c.embedding,
            d.original_filename, d.filename, d.file_extension
     FROM document_chunks c JOIN documents d ON d.id = c.document_id
     WHERE d.status='COMPLETED' ${fbConds.join(' ')}`,
    fbParams
  );
  const hits: RankedHit[] = [];
  for (const r of rows as Array<Record<string, unknown>>) {
    const raw = r['embedding'];
    if (raw == null) continue;
    const vec = typeof raw === 'string' ? (JSON.parse(raw) as number[]) : (raw as number[]);
    if (!Array.isArray(vec) || vec.length !== q.length) continue; // dim mismatch => skip (models can't mix)
    hits.push({ ...toHit(r), score: cosineSimilarity(q, vec) });
  }
  hits.sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex || (a.chunkId < b.chunkId ? -1 : 1));
  return hits.slice(0, opts.topK);
}

function toHit(r: Record<string, unknown>): RankedHit {
  const excerpt = String(r['content'] ?? '');
  return {
    documentId: String(r['document_id']),
    chunkId: String(r['id']),
    filename: String(r['filename'] ?? ''),
    originalFilename: String(r['original_filename'] ?? ''),
    fileExtension: String(r['file_extension'] ?? ''),
    chunkIndex: Number(r['chunk_index']),
    pageNumber: (r['page_number'] as number | null) ?? null,
    sheetName: (r['sheet_name'] as string | null) ?? null,
    content: excerpt.length > 1200 ? excerpt.slice(0, 1200) + '…' : excerpt,
    score: Number(r['score'] ?? 0)
  };
}
