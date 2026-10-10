import { parse } from 'csv-parse/sync';
import type { DocumentParser, ParseResult } from './types.js';

export class CsvParser implements DocumentParser {
  readonly format = 'csv' as const;

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    if (buffer.length === 0) throw new Error('Empty CSV file');
    const raw = buffer.toString('utf-8');
    let records: string[][];
    try {
      records = parse(raw, {
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        relax_quotes: true
      }) as string[][];
    } catch (err) {
      throw new Error(`CSV parse failed: ${(err as Error).message}`);
    }
    if (records.length === 0) {
      return { text: '', sections: [], format: 'csv', warnings: ['CSV has no rows'], metadata: { filename } };
    }
    const headers = records[0] ?? [];
    const warnings: string[] = [];
    if (headers.length === 0) warnings.push('CSV has no header row');
    // Preserve structure: "col: val | col: val" per row so retrieval keeps column context.
    const lines: string[] = [];
    if (headers.length > 0) lines.push(`Columns: ${headers.join(' | ')}`);
    for (let i = 1; i < records.length; i++) {
      const row = records[i] ?? [];
      const cells = headers.map((h, c) => `${h || `col${c}`}: ${row[c] ?? ''}`);
      lines.push(`Row ${i}: ${cells.join(' | ')}`);
    }
    const text = lines.join('\n');
    return {
      text,
      sections: lines.map((line, idx) => ({ rowIndex: idx, text: line })),
      format: 'csv',
      warnings,
      metadata: { filename, rowCount: records.length - 1, columnCount: headers.length, columns: headers }
    };
  }
}
