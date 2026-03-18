import winston from 'winston';
import path from 'path';

export const createLogger = () => {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const logFile = process.env.LOG_FILE || 'logs/app.log';

  const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'youtube-pronunciation-search' },
    transports: [
      // Write all logs with importance level of `error` or less to `error.log`
      new winston.transports.File({ 
        filename: path.join(process.cwd(), 'logs', 'error.log'), 
        level: 'error' 
      }),
      // Write all logs with importance level of `info` or less to combined log
      new winston.transports.File({ 
        filename: path.join(process.cwd(), logFile) 
      }),
    ],
  });

  // If we're not in production then log to the `console` with the format:
  // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }));
  }

  return logger;
};