import type { DocumentParser, SupportedExtension } from './types.js';
import { PdfParser } from './pdfParser.js';
import { DocxParser } from './docxParser.js';
import { TxtParser } from './txtParser.js';
import { CsvParser } from './csvParser.js';
import { XlsxParser } from './xlsxParser.js';
import { UnsupportedMediaError } from '../../errors/AppError.js';

const parsers = new Map<SupportedExtension, DocumentParser>([
  ['pdf', new PdfParser()],
  ['docx', new DocxParser()],
  ['txt', new TxtParser()],
  ['csv', new CsvParser()],
  ['xlsx', new XlsxParser()]
]);

export function getParser(ext: string): DocumentParser {
  const key = ext.toLowerCase().replace(/^\./, '') as SupportedExtension;
  const parser = parsers.get(key);
  if (!parser) throw new UnsupportedMediaError(`Unsupported file extension ".${key}". Allowed: pdf, docx, txt, csv, xlsx`);
  return parser;
}

export function supportedExtensions(): SupportedExtension[] {
  return [...parsers.keys()];
}
