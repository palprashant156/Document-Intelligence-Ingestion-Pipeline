import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { getJob } from '../repositories/jobRepo.js';
import { NotFoundError } from '../errors/AppError.js';

export const jobRouter = Router();

jobRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const job = await getJob(id);
    if (!job) throw new NotFoundError('Job not found');
    res.json({ success: true, data: { job } });
  } catch (err) {
    next(err);
  }
});
