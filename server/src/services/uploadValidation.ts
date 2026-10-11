import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { BadRequestError, PayloadTooLargeError, UnsupportedMediaError } from '../errors/AppError.js';
import { env } from '../config/env.js';

export const ALLOWED_EXTS = ['pdf', 'docx', 'txt', 'csv', 'xlsx'] as const;
export type AllowedExt = (typeof ALLOWED_EXTS)[number];

const MIME_BY_EXT: Record<AllowedExt, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  txt: ['text/plain'],
  csv: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip']
};

/** Extension allowlist — first gate, never sufficient alone. */
export function extFromFilename(filename: string): AllowedExt {
  const ext = extname(filename).toLowerCase().replace(/^\./, '');
  if ((ALLOWED_EXTS as readonly string[]).includes(ext)) return ext as AllowedExt;
  throw new UnsupportedMediaError(`Extension ".${ext}" not allowed. Allowed: ${ALLOWED_EXTS.join(', ')}`);
}

/** MIME check — client-provided, spoofable; signature check below is stronger. */
export function checkMime(ext: AllowedExt, mime: string): void {
  if (MIME_BY_EXT[ext].includes(mime)) return;
  // Be lenient for octet-stream (some browsers) but log-worthy; strictness lives in signature check.
  if (mime === 'application/octet-stream') return;
  throw new BadRequestError(`MIME "${mime}" does not match extension ".${ext}"`, 'MIME_MISMATCH');
}

/** File-signature (magic bytes) check — stronger than ext/MIME, still not proof of safety. */
export function checkSignature(ext: AllowedExt, buffer: Buffer): void {
  if (buffer.length === 0) throw new BadRequestError('Empty file', 'EMPTY_FILE');
  if (buffer.length > env.MAX_FILE_SIZE_BYTES) {
    throw new PayloadTooLargeError(`File exceeds ${env.MAX_FILE_SIZE_BYTES} bytes`);
  }
  switch (ext) {
    case 'pdf':
      if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new BadRequestError('Invalid PDF signature', 'BAD_SIGNATURE');
      break;
    case 'docx':
    case 'xlsx':
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new BadRequestError(`Invalid ${ext.toUpperCase()} signature (expected ZIP)`, 'BAD_SIGNATURE');
      break;
    case 'txt':
    case 'csv':
      // No magic bytes; parsers handle malformed content. Reject NUL-heavy binaries.
      if (buffer.subarray(0, 8000).includes(0)) throw new BadRequestError('File looks binary, not text/CSV', 'BAD_SIGNATURE');
      break;
  }
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Safe storage name: uuid + ext. Never use client filename for paths (traversal). */
export function safeStorageName(ext: AllowedExt): string {
  return `${randomUUID()}.${ext}`;
}
