import type {
  ApiEnvelope,
  ChunkDetail,
  ChunkPreview,
  Document,
  DocumentDetail,
  FileExtension,
  ProcessingJob,
  SearchResult
} from './types.js';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * API base resolution order: explicit Settings override (localStorage) >
 * build-time VITE_API_BASE > same-origin '/api' (vite dev proxy).
 * No keys, no secrets — the browser only ever talks to our own backend.
 */
export function resolveApiBase(): string {
  try {
    const override = localStorage.getItem('documind.apiBase');
    if (override && override.trim()) return override.trim().replace(/\/$/, '');
  } catch {
    // private mode etc — fall through to defaults
  }
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.['VITE_API_BASE'];
  if (env && env.trim()) return env.trim().replace(/\/$/, '');
  return '/api';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${resolveApiBase()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  });
  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(res.status, 'BAD_RESPONSE', `Server returned non-JSON (${res.status})`);
  }
  if (!res.ok || body.success === false) {
    throw new ApiError(res.status, body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? `Request failed (${res.status})`);
  }
  return body.data as T;
}

export interface UploadedItem {
  document: Document;
  jobId: string;
  chunks: number;
}

export async function uploadDocuments(files: File[]): Promise<UploadedItem[]> {
  const form = new FormData();
  for (const f of files) form.append('files', f, f.name);
  const res = await fetch(`${resolveApiBase()}/documents`, { method: 'POST', body: form });
  let body: ApiEnvelope<{ documents: UploadedItem[] }>;
  try {
    body = (await res.json()) as ApiEnvelope<{ documents: UploadedItem[] }>;
  } catch {
    throw new ApiError(res.status, 'BAD_RESPONSE', `Server returned non-JSON (${res.status})`);
  }
  if (!res.ok || body.success === false) {
    throw new ApiError(res.status, body.error?.code ?? 'UPLOAD_FAILED', body.error?.message ?? 'Upload failed');
  }
  return (body.data as { documents: UploadedItem[] }).documents;
}

export async function listDocuments(limit = 100, offset = 0): Promise<{ documents: Document[]; total: number }> {
  return request<{ documents: Document[]; total: number }>(`/documents?limit=${limit}&offset=${offset}`);
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  return request<DocumentDetail>(`/documents/${id}`);
}

export async function deleteDocument(id: string): Promise<void> {
  await request<{ deleted: boolean }>(`/documents/${id}`, { method: 'DELETE' });
}

export async function retryDocument(id: string): Promise<{ document: Document; jobId: string }> {
  return request<{ document: Document; jobId: string }>(`/documents/${id}/retry`, { method: 'POST' });
}

export async function listChunks(documentId: string, limit = 100, offset = 0): Promise<{ chunks: ChunkPreview[]; total: number }> {
  return request<{ chunks: ChunkPreview[]; total: number }>(`/documents/${documentId}/chunks?limit=${limit}&offset=${offset}`);
}

export async function getChunk(documentId: string, chunkId: string): Promise<{ chunk: ChunkDetail }> {
  return request<{ chunk: ChunkDetail }>(`/documents/${documentId}/chunks/${chunkId}`);
}

export async function getJob(id: string): Promise<{ job: ProcessingJob }> {
  return request<{ job: ProcessingJob }>(`/jobs/${id}`);
}

export interface SearchFilters {
  documentId?: string | null;
  fileTypes?: FileExtension[] | null;
}

export async function search(
  query: string,
  topK: number,
  filters?: SearchFilters
): Promise<{ results: SearchResult[]; query: string; topK: number }> {
  return request<{ results: SearchResult[]; query: string; topK: number }>(`/search`, {
    method: 'POST',
    body: JSON.stringify({ query, topK, filters: { documentId: filters?.documentId ?? null, fileTypes: filters?.fileTypes ?? null } })
  });
}

export async function health(): Promise<{ status: string; service: string; time: string }> {
  return request<{ status: string; service: string; time: string }>(`/health`);
}
