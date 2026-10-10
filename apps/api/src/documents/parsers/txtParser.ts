import type { DocumentParser, ParseResult } from './types.js';

export class TxtParser implements DocumentParser {
  readonly format = 'txt' as const;

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    if (buffer.length === 0) {
      return { text: '', sections: [], format: 'txt', warnings: ['Empty file'], metadata: { filename } };
    }
    // Strip BOM, tolerate invalid UTF-8 via replacement character.
    let text = buffer.toString('utf-8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const warnings: string[] = [];
    if (text.includes('�')) warnings.push('File contained invalid UTF-8 sequences (replaced)');
    return {
      text,
      sections: [{ text }],
      format: 'txt',
      warnings,
      metadata: { filename, bytes: buffer.length }
    };
  }
}
