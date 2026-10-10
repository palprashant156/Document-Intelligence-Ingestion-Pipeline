import { getPool } from '../database/db.js';

export interface DocumentRow {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_extension: string;
  file_size_bytes: number;
  sha256: string;
  storage_path: string;
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  page_count: number | null;
  error_message: string | null;
  embedding_provider: string | null;
  embedding_model: string | null;
  embedding_dim: number | null;
  created_at: string;
  updated_at: string;
}

export async function insertDocument(d: {
  filename: string; originalFilename: string; mimeType: string; fileExtension: string;
  fileSizeBytes: number; sha256: string; storagePath: string;
}): Promise<DocumentRow> {
  const { rows } = await getPool().query(
    `INSERT INTO documents (filename, original_filename, mime_type, file_extension, file_size_bytes, sha256, storage_path, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'UPLOADED') RETURNING *`,
    [d.filename, d.originalFilename, d.mimeType, d.fileExtension, d.fileSizeBytes, d.sha256, d.storagePath]
  );
  return rows[0] as DocumentRow;
}

export async function listDocuments(limit = 50, offset = 0): Promise<{ rows: DocumentRow[]; total: number }> {
  const pool = getPool();
  const total = await pool.query(`SELECT COUNT(*)::int AS c FROM documents`);
  const { rows } = await pool.query(`SELECT * FROM documents ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
  return { rows: rows as DocumentRow[], total: (total.rows[0] as { c: number }).c };
}

export async function getDocument(id: string): Promise<DocumentRow | null> {
  const { rows } = await getPool().query(`SELECT * FROM documents WHERE id=$1`, [id]);
  return (rows[0] as DocumentRow | undefined) ?? null;
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentRow['status'],
  patch?: { errorMessage?: string | null; pageCount?: number | null; provider?: string; model?: string; dim?: number }
): Promise<void> {
  await getPool().query(
    `UPDATE documents SET status=$2, error_message=$3, page_count=COALESCE($4, page_count),
      embedding_provider=COALESCE($5, embedding_provider), embedding_model=COALESCE($6, embedding_model),
      embedding_dim=COALESCE($7, embedding_dim), updated_at=now() WHERE id=$1`,
    [id, status, patch?.errorMessage ?? null, patch?.pageCount ?? null, patch?.provider ?? null, patch?.model ?? null, patch?.dim ?? null]
  );
}

export async function deleteDocument(id: string): Promise<string | null> {
  const doc = await getDocument(id);
  if (!doc) return null;
  await getPool().query(`DELETE FROM documents WHERE id=$1`, [id]);
  return doc.storage_path;
}
