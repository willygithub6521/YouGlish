import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger.js';
import { ApiError } from '../types/index.js';

const logger = createLogger();

interface CustomError extends Error {
  status?: number;
  code?: string;
  details?: any;
}

const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Default error values
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid request data';
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    message = 'Invalid ID format';
  } else if (err.name === 'MongoError' && err.message.includes('duplicate key')) {
    status = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'Resource already exists';
  } else if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
    status = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = 'External service unavailable';
  }

  // Prepare error response
  const errorResponse: { error: ApiError } = {
    error: {
      code,
      message,
      ...(err.details && { details: err.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  };

  res.status(status).json(errorResponse);
};

export default errorHandler;