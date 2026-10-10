import XLSX from 'xlsx';
import type { DocumentParser, PageSection, ParseResult } from './types.js';

const MAX_CELLS = 50_000; // guard against huge sheets exhausting memory

export class XlsxParser implements DocumentParser {
  readonly format = 'xlsx' as const;

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    if (buffer.length === 0) throw new Error('Empty XLSX file');
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new Error('Not a valid XLSX file (missing ZIP signature)');
    }
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(buffer, { type: 'buffer', dense: true });
    } catch (err) {
      throw new Error(`XLSX parse failed: ${(err as Error).message}`);
    }
    const warnings: string[] = [];
    const sections: PageSection[] = [];
    const blocks: string[] = [];
    let cells = 0;

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      if (rows.length === 0) {
        warnings.push(`Sheet "${sheetName}" is empty`);
        continue;
      }
      const header = (rows[0] as unknown[]).map((h, i) => String(h || `col${i}`));
      blocks.push(`Sheet: ${sheetName}\nColumns: ${header.join(' | ')}`);
      for (let r = 1; r < rows.length; r++) {
        cells += header.length;
        if (cells > MAX_CELLS) {
          warnings.push(`Truncated at ${MAX_CELLS} cells to bound memory (sheet "${sheetName}")`);
          break;
        }
        const row = rows[r] as unknown[];
        const line = `Row ${r}: ${header.map((h, c) => `${h}: ${String(row[c] ?? '')}`).join(' | ')}`;
        blocks.push(line);
        sections.push({ sheetName, rowIndex: r, text: line });
      }
    }

    const text = blocks.join('\n');
    if (!text.trim()) warnings.push('Workbook contained no extractable text');
    return {
      text,
      sections,
      format: 'xlsx',
      sheetNames: wb.SheetNames,
      warnings,
      metadata: { filename, sheetCount: wb.SheetNames.length, cells }
    };
  }
}
