import { getPool } from '../database/db.js';

export interface JobRow {
  id: string;
  document_id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  attempt_count: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export async function createJob(documentId: string): Promise<JobRow> {
  const { rows } = await getPool().query(
    `INSERT INTO processing_jobs (document_id, status) VALUES ($1,'PENDING') RETURNING *`,
    [documentId]
  );
  return rows[0] as JobRow;
}

export async function getJob(id: string): Promise<JobRow | null> {
  const { rows } = await getPool().query(`SELECT * FROM processing_jobs WHERE id=$1`, [id]);
  return (rows[0] as JobRow | undefined) ?? null;
}

export async function latestJobForDocument(documentId: string): Promise<JobRow | null> {
  const { rows } = await getPool().query(
    `SELECT * FROM processing_jobs WHERE document_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [documentId]
  );
  return (rows[0] as JobRow | undefined) ?? null;
}

export async function markJobRunning(id: string): Promise<void> {
  await getPool().query(
    `UPDATE processing_jobs SET status='RUNNING', attempt_count=attempt_count+1, started_at=now() WHERE id=$1`,
    [id]
  );
}

export async function markJobDone(id: string, ok: boolean, errorMessage?: string): Promise<void> {
  await getPool().query(
    `UPDATE processing_jobs SET status=$2, completed_at=now(), error_message=$3 WHERE id=$1`,
    [id, ok ? 'SUCCEEDED' : 'FAILED', errorMessage ?? null]
  );
}
