import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { searchChunks } from '../retrieval/searchService.js';

export const searchRouter = Router();

const searchSchema = z.object({
  query: z.string().min(1).max(1000),
  topK: z.number().int().min(1).max(20).default(5),
  filters: z
    .object({
      documentId: z.string().uuid().nullable().optional(),
      fileTypes: z.array(z.enum(['pdf', 'docx', 'txt', 'csv', 'xlsx'])).nullable().optional()
    })
    .default({})
});

searchRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = searchSchema.parse(req.body);
    const results = await searchChunks(body.query, {
      topK: body.topK,
      documentId: body.filters.documentId ?? null,
      fileTypes: body.filters.fileTypes ?? null
    });
    res.json({ success: true, data: { results, query: body.query, topK: body.topK } });
  } catch (err) {
    next(err);
  }
});
