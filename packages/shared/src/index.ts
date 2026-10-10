export type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface SearchFilters {
  documentId?: string | null;
  fileTypes?: Array<'pdf' | 'docx' | 'txt' | 'csv' | 'xlsx'> | null;
}

export interface SearchRequest {
  query: string;
  topK?: number;
  filters?: SearchFilters;
}
