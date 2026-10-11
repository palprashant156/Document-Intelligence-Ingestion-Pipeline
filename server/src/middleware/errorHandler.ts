import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';
import { logger } from '../config/logger.js';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId ?? 'unknown';

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        requestId
      }
    });
    return;
  }

  if (err instanceof AppError) {
    if (!err.isOperational || err.statusCode >= 500) {
      logger.error({ err, requestId }, 'operational error');
    }
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, requestId }
    });
    return;
  }

  // Multer errors
  const maybeCode = (err as { code?: string })?.code;
  if (maybeCode === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      success: false,
      error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 10 MB limit', requestId }
    });
    return;
  }
  if (maybeCode === 'LIMIT_FILE_COUNT') {
    res.status(400).json({
      success: false,
      error: { code: 'TOO_MANY_FILES', message: 'Too many files in request', requestId }
    });
    return;
  }

  logger.error({ err, requestId }, 'unhandled error');
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId }
  });
}
