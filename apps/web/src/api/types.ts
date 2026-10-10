export type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type FileExtension = 'pdf' | 'docx' | 'txt' | 'csv' | 'xlsx';

export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_extension: FileExtension;
  file_size_bytes: number;
  sha256: string;
  storage_path: string;
  status: DocumentStatus;
  page_count: number | null;
  error_message: string | null;
  embedding_provider: string | null;
  embedding_model: string | null;
  embedding_dim: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessingJob {
  id: string;
  document_id: string;
  status: JobStatus;
  attempt_count: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ChunkPreview {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  token_estimate: number | null;
  page_number: number | null;
  sheet_name: string | null;
  chunk_metadata: Record<string, unknown>;
  /** Truncated server-side: first 8 values only. */
  embedding: number[] | null;
  created_at: string;
}

export interface ChunkDetail extends Omit<ChunkPreview, 'embedding'> {
  /** Full vector when present (128 floats for mock) — used by the inspector. */
  embedding: number[] | null;
  embeddingPreview: number[] | null;
}

export interface DocumentDetail {
  document: Document;
  chunkCount: number;
  latestJob: ProcessingJob | null;
}

export interface SearchResult {
  documentId: string;
  chunkId: string;
  filename: string;
  originalFilename: string;
  fileExtension: string;
  chunkIndex: number;
  pageNumber: number | null;
  sheetName: string | null;
  content: string;
  /** Cosine similarity (higher = more similar). Not a probability. */
  score: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; requestId?: string; details?: unknown };
}

export const SUPPORTED_EXTENSIONS: FileExtension[] = ['pdf', 'docx', 'txt', 'csv', 'xlsx'];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
