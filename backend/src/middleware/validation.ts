import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult, ValidationChain } from 'express-validator';
import { Accent } from '../types/index.js';

// Custom validation middleware to handle validation results
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined,
    }));

    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: formattedErrors,
      },
    });
    return;
  }
  
  next();
};

// Search validation rules
const validateSearch = (): ValidationChain[] => [
  query('q')
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters')
    .trim()
    .escape(),
  
  query('accent')
    .optional()
    .isIn(['ALL', 'US', 'UK', 'AU', 'CA', 'OTHER'])
    .withMessage('Invalid accent value'),
  
  query('fuzzy')
    .optional()
    .isBoolean()
    .withMessage('Fuzzy must be a boolean value'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
];

// Video ID validation rules
const validateVideoId = (): ValidationChain[] => [
  param('videoId')
    .notEmpty()
    .withMessage('Video ID is required')
    .matches(/^[a-zA-Z0-9_-]{11}$/)
    .withMessage('Invalid YouTube video ID format'),
];

// Suggestions validation rules
const validateSuggestions = (): ValidationChain[] => [
  query('prefix')
    .notEmpty()
    .withMessage('Prefix is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Prefix must be between 1 and 50 characters')
    .trim()
    .escape(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be an integer between 1 and 20'),
];

// Request sanitization middleware
const sanitizeRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        // Remove potentially dangerous characters
        req.query[key] = (req.query[key] as string)
          .replace(/[<>]/g, '') // Remove angle brackets
          .trim();
      }
    });
  }

  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key]
          .replace(/[<>]/g, '') // Remove angle brackets
          .trim();
      }
    });
  }

  next();
};

// Rate limiting for search endpoints
const searchRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  // Additional rate limiting logic for search can be added here
  // For now, we rely on the global rate limiter
  next();
};

export default {
  handleValidationErrors,
  validateSearch,
  validateVideoId,
  validateSuggestions,
  sanitizeRequest,
  searchRateLimit,
};