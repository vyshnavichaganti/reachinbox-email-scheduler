import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { env } from '../config/env';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError('Route not found', 404));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : 'Internal server error';

  if (!isAppError || statusCode >= 500) {
    logger.error('Unhandled error', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  } else {
    logger.warn('Request error', { statusCode, message, details: isAppError ? err.details : undefined });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(isAppError && err.details !== undefined ? { details: err.details } : {}),
      ...(env.NODE_ENV === 'development' && err instanceof Error && !isAppError
        ? { stack: err.stack }
        : {}),
    },
  });
}
