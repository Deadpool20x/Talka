import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    logger.error({ code: err.code, message: err.message, details: err.details });
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  logger.error({ unhandled: true, message: err.message, stack: err.stack });
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      // Temporarily expose error details to diagnose production issues
      detail: err.message,
      type: err.constructor?.name,
    },
  });
}
