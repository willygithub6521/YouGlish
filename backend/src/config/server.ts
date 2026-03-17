import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const serverConfig = {
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS settings
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  
  // Rate limiting settings
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },
  
  // Body parser settings
  bodyParser: {
    jsonLimit: process.env.BODY_PARSER_JSON_LIMIT || '10mb',
    urlencodedLimit: process.env.BODY_PARSER_URLENCODED_LIMIT || '10mb',
  },
  
  // Security settings
  security: {
    helmet: {
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
    },
  },
  
  // Logging settings
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
};

export default serverConfig;