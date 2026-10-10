import { describe, it, expect } from 'vitest';
import { extFromFilename, checkMime, checkSignature } from '../src/services/uploadValidation.js';

describe('upload validation', () => {
  it('accepts allowed extensions', () => {
    for (const f of ['a.pdf', 'b.DOCX', 'c.txt', 'd.csv', 'e.xlsx']) {
      expect(() => extFromFilename(f)).not.toThrow();
    }
  });

  it('rejects disallowed extensions', () => {
    expect(() => extFromFilename('evil.exe')).toThrow();
    expect(() => extFromFilename('noext')).toThrow();
    expect(() => extFromFilename('../../etc/passwd')).toThrow();
  });

  it('rejects MIME mismatch', () => {
    expect(() => checkMime('pdf', 'application/pdf')).not.toThrow();
    expect(() => checkMime('pdf', 'image/png')).toThrow();
  });

  it('rejects empty files and bad signatures', () => {
    expect(() => checkSignature('pdf', Buffer.alloc(0))).toThrow();
    expect(() => checkSignature('pdf', Buffer.from('not a pdf'))).toThrow();
    expect(() => checkSignature('pdf', Buffer.from('%PDF-1.4 fake'))).not.toThrow();
    expect(() => checkSignature('docx', Buffer.from('PK\x03\x04data'))).not.toThrow();
    expect(() => checkSignature('docx', Buffer.from('not a zip'))).toThrow();
  });
});
