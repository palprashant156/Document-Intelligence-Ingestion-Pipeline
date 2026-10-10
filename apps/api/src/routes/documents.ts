import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../config/env.js';
import { BadRequestError, NotFoundError } from '../errors/AppError.js';
import { checkMime, checkSignature, extFromFilename, safeStorageName, sha256 } from '../services/uploadValidation.js';
import { deleteDocument, getDocument, insertDocument, listDocuments } from '../repositories/documentRepo.js';
import { countChunks, listChunks, getChunk } from '../repositories/chunkRepo.js';
import { createJob, latestJobForDocument } from '../repositories/jobRepo.js';
import { processDocument } from '../services/ingestionService.js';

export const documentRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE_BYTES, files: env.MAX_FILES_PER_REQUEST }
});

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

function storagePaths() {
  mkdirSync(env.STORAGE_DIR, { recursive: true });
  return env.STORAGE_DIR;
}

// POST /api/documents — upload 1..N files, persist metadata, run sync ingestion MVP.
documentRouter.post('/', upload.array('files', env.MAX_FILES_PER_REQUEST), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) throw new BadRequestError('No files uploaded (field name "files")');
    storagePaths();
    const results = [];
    for (const f of files) {
      const ext = extFromFilename(f.originalname);
      checkMime(ext, f.mimetype);
      checkSignature(ext, f.buffer);
      const stored = safeStorageName(ext);
      const fullPath = join(env.STORAGE_DIR, stored);
      writeFileSync(fullPath, f.buffer);
      const row = await insertDocument({
        filename: stored,
        originalFilename: f.originalname,
        mimeType: f.mimetype,
        fileExtension: ext,
        fileSizeBytes: f.size,
        sha256: sha256(f.buffer),
        storagePath: fullPath
      });
      const job = await createJob(row.id);
      try {
        await processDocument(row.id, job.id);
      } catch (err) {
        // Status already FAILED with safe message; continue other files.
      }
      const done = await getDocument(row.id);
      results.push({ document: done, jobId: job.id, chunks: done?.status === 'COMPLETED' ? await countChunks(row.id) : 0 });
    }
    res.status(201).json({ success: true, data: { documents: results } });
  } catch (err) {
    next(err);
  }
});

documentRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = listQuery.parse(req.query);
    const { rows, total } = await listDocuments(q.limit, q.offset);
    res.json({ success: true, data: { documents: rows, total, limit: q.limit, offset: q.offset } });
  } catch (err) {
    next(err);
  }
});

documentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await getDocument(req.params.id!);
    if (!doc) throw new NotFoundError('Document not found');
    const [chunks, job] = await Promise.all([countChunks(doc.id), latestJobForDocument(doc.id)]);
    res.json({ success: true, data: { document: doc, chunkCount: chunks, latestJob: job } });
  } catch (err) {
    next(err);
  }
});

documentRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storagePath = await deleteDocument(req.params.id!);
    if (!storagePath) throw new NotFoundError('Document not found');
    try {
      unlinkSync(storagePath);
    } catch {
      // File already gone — DB row is source of truth.
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/:id/retry — only FAILED docs, idempotent re-process.
documentRouter.post('/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await getDocument(req.params.id!);
    if (!doc) throw new NotFoundError('Document not found');
    if (doc.status !== 'FAILED') throw new BadRequestError(`Only FAILED documents can be retried (status=${doc.status})`);
    const job = await createJob(doc.id);
    try {
      await processDocument(doc.id, job.id);
    } catch {
      // status reflects failure
    }
    const updated = await getDocument(doc.id);
    res.json({ success: true, data: { document: updated, jobId: job.id } });
  } catch (err) {
    next(err);
  }
});

documentRouter.get('/:id/chunks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await getDocument(req.params.id!);
    if (!doc) throw new NotFoundError('Document not found');
    const q = listQuery.parse(req.query);
    const chunks = await listChunks(doc.id, q.limit, q.offset);
    const preview = chunks.map((c) => ({ ...c, embedding: c.embedding ? c.embedding.slice(0, 8) : null }));
    res.json({ success: true, data: { chunks: preview, total: await countChunks(doc.id) } });
  } catch (err) {
    next(err);
  }
});

documentRouter.get('/:id/chunks/:chunkId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chunk = await getChunk(req.params.id!, req.params.chunkId!);
    if (!chunk) throw new NotFoundError('Chunk not found');
    res.json({ success: true, data: { chunk: { ...chunk, embeddingPreview: chunk.embedding?.slice(0, 16) ?? null } } });
  } catch (err) {
    next(err);
  }
});

// Back-compat: read stored original bytes (dev inspection).
documentRouter.get('/:id/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await getDocument(req.params.id!);
    if (!doc) throw new NotFoundError('Document not found');
    const buf = await readFile(doc.storage_path);
    res.setHeader('Content-Type', doc.mime_type);
    res.send(buf);
  } catch (err) {
    next(err);
  }
});
