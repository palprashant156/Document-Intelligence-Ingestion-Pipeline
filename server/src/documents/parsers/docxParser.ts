import mammoth from 'mammoth';
import type { DocumentParser, ParseResult } from './types.js';

export class DocxParser implements DocumentParser {
  readonly format = 'docx' as const;

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    if (buffer.length === 0) throw new Error('Empty DOCX file');
    // DOCX is a zip — must start with PK.
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new Error('Not a valid DOCX file (missing ZIP signature)');
    }
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value ?? '';
      const warnings = (result.messages ?? []).map((m) => `${m.type}: ${m.message}`);
      if (!text.trim()) warnings.push('DOCX contained no extractable text');
      return {
        text,
        sections: [{ text }],
        format: 'docx',
        warnings,
        metadata: { filename, bytes: buffer.length }
      };
    } catch (err) {
      throw new Error(`DOCX parse failed: ${(err as Error).message}`);
    }
  }
}
