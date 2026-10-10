/**
 * Normalization: pure function, format-agnostic.
 * - Unicode NFC normalize
 * - Strip control chars (keep \n \t)
 * - Collapse whitespace, normalize line endings
 * - Drop empty sections, trim
 * CSV/XLSX row prefixes ("Row 3: ...") are preserved — they carry structure.
 */
export interface NormalizationResult {
  text: string;
  warnings: string[];
}

export function normalizeText(input: string): NormalizationResult {
  const warnings: string[] = [];
  if (!input || input.trim().length === 0) {
    return { text: '', warnings: ['Empty text after extraction'] };
  }
  let text = input.normalize('NFC');
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  text = text.replace(/\r\n?/g, '\n');
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t\u00A0\u2000-\u200B\u3000]+/g, ' ').trim())
    .join('\n');
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  if (text.length === 0) warnings.push('Empty text after normalization');
  return { text, warnings };
}
