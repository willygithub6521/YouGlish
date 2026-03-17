import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

interface RequestLogData {
  method: string;
  url: string;
  ip: string;
  userAgent?: string;
  contentLength?: string;
  responseTime?: number;
  statusCode?: number;
}

const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log incoming request
  const requestData: RequestLogData = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
  };

  logger.info('Incoming request', requestData);

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any): Response {
    const responseTime = Date.now() - startTime;
    
    // Log response
    const responseData: RequestLogData = {
      ...requestData,
      responseTime,
      statusCode: res.statusCode,
    };

    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', responseData);
    } else {
      logger.info('Request completed successfully', responseData);
    }

    // Call original end method
    originalEnd.call(this, chunk, encoding);
    return this;
  };

  next();
};

export default requestLogger;