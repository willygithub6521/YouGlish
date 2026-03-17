import { Request, Response } from 'express';

const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `The requested resource '${req.originalUrl}' was not found`,
      details: {
        method: req.method,
        path: req.path,
      },
    },
  });
};

export default notFound;