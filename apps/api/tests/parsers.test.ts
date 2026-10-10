import { describe, it, expect } from 'vitest';
import { getParser, supportedExtensions } from '../src/documents/parsers/registry.js';
import { TxtParser } from '../src/documents/parsers/txtParser.js';
import { CsvParser } from '../src/documents/parsers/csvParser.js';
import { XlsxParser } from '../src/documents/parsers/xlsxParser.js';
import { DocxParser } from '../src/documents/parsers/docxParser.js';
import { PdfParser } from '../src/documents/parsers/pdfParser.js';
import XLSX from 'xlsx';

describe('parser registry', () => {
  it('resolves all five formats', () => {
    expect(supportedExtensions().sort()).toEqual(['csv', 'docx', 'pdf', 'txt', 'xlsx']);
    for (const ext of supportedExtensions()) {
      expect(getParser(ext).format).toBe(ext);
    }
  });

  it('rejects unknown extensions', () => {
    expect(() => getParser('exe')).toThrow();
  });
});

describe('txt parser', () => {
  it('extracts text and strips BOM', async () => {
    const r = await new TxtParser().parse(Buffer.from('﻿hello'), 'a.txt');
    expect(r.text).toBe('hello');
  });
});

describe('csv parser', () => {
  it('preserves headers and row relationships', async () => {
    const r = await new CsvParser().parse(Buffer.from('name,leave\namy,12\nbob,7'), 'l.csv');
    expect(r.text).toContain('Columns: name | leave');
    expect(r.text).toContain('Row 1: name: amy | leave: 12');
    expect(r.metadata).toMatchObject({ rowCount: 2 });
  });

  it('rejects empty csv', async () => {
    await expect(new CsvParser().parse(Buffer.alloc(0), 'e.csv')).rejects.toThrow();
  });
});

describe('xlsx parser', () => {
  it('extracts sheets with headers', async () => {
    const wb = XLSX.utils.book_new();
    wb.SheetNames.push('Staff');
    wb.Sheets['Staff'] = XLSX.utils.aoa_to_sheet([['name', 'leave'], ['amy', 12]]);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const r = await new XlsxParser().parse(Buffer.from(buf), 's.xlsx');
    expect(r.sheetNames).toEqual(['Staff']);
    expect(r.text).toContain('name: amy');
  });

  it('rejects non-zip bytes', async () => {
    await expect(new XlsxParser().parse(Buffer.from('hello'), 'f.xlsx')).rejects.toThrow();
  });
});

describe('docx/pdf guards', () => {
  it('docx rejects non-zip', async () => {
    await expect(new DocxParser().parse(Buffer.from('hello'), 'f.docx')).rejects.toThrow();
  });
  it('pdf rejects non-pdf', async () => {
    await expect(new PdfParser().parse(Buffer.from('hello'), 'f.pdf')).rejects.toThrow();
  });
  it('pdf rejects empty', async () => {
    await expect(new PdfParser().parse(Buffer.alloc(0), 'e.pdf')).rejects.toThrow();
  });
});
