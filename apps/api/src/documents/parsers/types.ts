export type SupportedExtension = 'pdf' | 'docx' | 'txt' | 'csv' | 'xlsx';

export interface PageSection {
  pageNumber?: number;
  sheetName?: string;
  rowIndex?: number;
  text: string;
}

export interface ParseResult {
  /** Unified plain text (sections joined). CSV/XLSX preserve headers + row structure. */
  text: string;
  sections: PageSection[];
  format: SupportedExtension;
  pageCount?: number;
  sheetNames?: string[];
  warnings: string[];
  metadata: Record<string, unknown>;
}

export interface DocumentParser {
  readonly format: SupportedExtension;
  parse(buffer: Buffer, filename: string): Promise<ParseResult>;
}
