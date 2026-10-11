import { readFile } from 'node:fs/promises';
import { getParser } from '../documents/parsers/registry.js';
import { normalizeText } from '../documents/normalization/normalizer.js';
import { chunkText } from '../documents/chunking/chunker.js';
import { getEmbeddingProvider } from '../embeddings/index.js';
import { getDocument, updateDocumentStatus } from '../repositories/documentRepo.js';
import { insertChunks } from '../repositories/chunkRepo.js';
import { createJob, markJobDone, markJobRunning } from '../repositories/jobRepo.js';
import { extFromFilename } from './uploadValidation.js';
import { logger } from '../config/logger.js';

/**
 * Full ingestion pipeline (synchronous MVP):
 * storage file -> detect -> parse -> normalize -> chunk -> embed -> persist -> status.
 * Idempotent: chunk insert uses ON CONFLICT (document_id, chunk_index) so
 * retrying a job never duplicates chunks.
 */
export async function processDocument(documentId: string, jobId?: string): Promise<void> {
  const doc = await getDocument(documentId);
  if (!doc) throw new Error(`Document ${documentId} not found`);

  const job = jobId ? { id: jobId } : await createJob(documentId);
  await markJobRunning(job.id);
  await updateDocumentStatus(documentId, 'PROCESSING', { errorMessage: null });

  try {
    const buffer = await readFile(doc.storage_path);
    const ext = extFromFilename(doc.original_filename);
    const parser = getParser(ext);

    const parsed = await parser.parse(buffer, doc.original_filename);
    const { text: normalized, warnings: normWarnings } = normalizeText(parsed.text);
    if (!normalized) {
      throw new Error(`No extractable text (${[...parsed.warnings, ...normWarnings].join('; ') || 'empty'})`);
    }

    const chunks = chunkText(normalized);
    if (chunks.length === 0) throw new Error('Chunking produced zero chunks');

    // Map chunk -> page/sheet where parser gave per-section info (best-effort).
    const provider = getEmbeddingProvider();
    const vectors = await provider.embedBatch(chunks.map((c) => c.content));

    await insertChunks(
      documentId,
      chunks.map((c, i) => ({
        chunkIndex: c.index,
        content: c.content,
        tokenEstimate: c.tokenEstimate,
        pageNumber: inferPage(parsed.sections, c.content),
        metadata: { warnings: parsed.warnings }
      })).map((row, i) => ({ ...row, embedding: vectors[i]! }))
    );

    await updateDocumentStatus(documentId, 'COMPLETED', {
      pageCount: parsed.pageCount ?? null,
      provider: provider.name,
      model: provider.name === 'gemini' ? 'text-embedding-004' : 'mock-hash-bag',
      dim: provider.dimensions
    });
    await markJobDone(job.id, true);
    logger.info({ documentId, chunks: chunks.length }, 'ingestion completed');
  } catch (err) {
    const message = (err as Error).message.slice(0, 500);
    await updateDocumentStatus(documentId, 'FAILED', { errorMessage: message });
    await markJobDone(job.id, false, message);
    logger.warn({ documentId, err: message }, 'ingestion failed');
    throw err;
  }
}

function inferPage(sections: Array<{ pageNumber?: number; text: string }>, chunkContent: string): number | null {
  const head = chunkContent.slice(0, 80);
  for (const s of sections) {
    if (s.pageNumber && s.text.includes(head)) return s.pageNumber;
  }
  return null;
}
