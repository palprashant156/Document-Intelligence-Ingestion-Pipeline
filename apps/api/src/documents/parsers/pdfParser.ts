import type { DocumentParser, PageSection, ParseResult } from './types.js';

/**
 * PDF text extraction via pdfjs-dist (Mozilla, maintained).
 * No OCR: scanned PDFs (image-only) return little/no text — that is expected
 * and reported via warnings, not silently treated as success.
 */
export class PdfParser implements DocumentParser {
  readonly format = 'pdf' as const;

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    if (buffer.length === 0) throw new Error('Empty PDF file');
    if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('Not a valid PDF file (missing %PDF- signature)');
    }
    const warnings: string[] = [];
    let pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs');
    try {
      pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    } catch (err) {
      throw new Error(`PDF engine failed to load: ${(err as Error).message}`);
    }

    interface PdfTextItem {
      str?: string;
    }
    interface PdfPage {
      getTextContent(): Promise<{ items: PdfTextItem[] }>;
    }
    interface PdfDoc {
      numPages: number;
      getPage(n: number): Promise<PdfPage>;
    }

    let doc: PdfDoc;
    try {
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
      doc = (await loadingTask.promise) as unknown as typeof doc;
    } catch (err) {
      throw new Error(`PDF parse failed (malformed/encrypted?): ${(err as Error).message}`);
    }

    const sections: PageSection[] = [];
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      try {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        const strings = content.items.map((it) => it.str ?? '').filter((s) => s.length > 0);
        const pageText = strings.join(' ').replace(/\s+/g, ' ').trim();
        pages.push(pageText);
        sections.push({ pageNumber: n, text: pageText });
      } catch (err) {
        warnings.push(`Page ${n} failed: ${(err as Error).message}`);
        sections.push({ pageNumber: n, text: '' });
        pages.push('');
      }
    }

    const text = pages.map((p, i) => (p ? `[Page ${i + 1}]\n${p}` : '')).filter(Boolean).join('\n\n');
    const nonEmpty = pages.filter((p) => p.trim().length > 0).length;
    if (nonEmpty === 0) {
      warnings.push('PDF contained no extractable text (likely scanned/images-only — OCR required, not included in MVP)');
    } else if (nonEmpty < pages.length) {
      warnings.push(`${pages.length - nonEmpty}/${pages.length} pages had no extractable text`);
    }

    return {
      text,
      sections,
      format: 'pdf',
      pageCount: doc.numPages,
      warnings,
      metadata: { filename, bytes: buffer.length, pagesExtracted: nonEmpty }
    };
  }
}
