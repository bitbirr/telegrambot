import { errorHandler, logger } from '../services/productionLogger.js';

// Custom error classes for better error handling
export class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

export class ExternalServiceError extends AppError {
  constructor(service, message = 'External service error') {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
  }
}

// Error response formatter
const formatErrorResponse = (error, req) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const baseResponse = {
    status: 'error',
    error: {
      message: error.message,
      code: error.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      request_id: req.id || req.headers['x-request-id']
    }
  };

  // Add additional details in development
  if (!isProduction) {
    baseResponse.error.stack = error.stack;
    baseResponse.error.details = {
      name: error.name,
      statusCode: error.statusCode,
      isOperational: error.isOperational
    };
  }

  // Add field information for validation errors
  if (error instanceof ValidationError && error.field) {
    baseResponse.error.field = error.field;
  }

  // Add service information for external service errors
  if (error instanceof ExternalServiceError && error.service) {
    baseResponse.error.service = error.service;
  }

  return baseResponse;
};

// Main error handling middleware
export const errorMiddleware = async (error, req, res, next) => {
  // Set default error properties
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (error.code === 11000) {
    statusCode = 409;
    message = 'Duplicate field value';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Create standardized error object
  const standardizedError = new AppError(message, statusCode, error.code);
  standardizedError.stack = error.stack;

  // Log error with context
  const errorContext = {
    request: {
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'content-type': req.headers['content-type']
      },
      body: req.method !== 'GET' ? req.body : undefined,
      query: req.query,
      params: req.params,
      ip: req.ip,
      user_id: req.user?.id || req.session?.userId
    },
    response: {
      status_code: statusCode
    }
  };

  // Log error
  await errorHandler.logError(standardizedError, errorContext);

  // Format and send error response
  const errorResponse = formatErrorResponse(standardizedError, req);
  
  res.status(statusCode).json(errorResponse);
};

// 404 handler middleware
export const notFoundMiddleware = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Request timeout middleware
export const timeoutMiddleware = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        const error = new AppError('Request timeout', 408, 'REQUEST_TIMEOUT');
        next(error);
      }
    }, timeout);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    res.on('close', () => {
      clearTimeout(timer);
    });

    next();
  };
};

// Request logging middleware
export const requestLoggerMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Generate request ID if not present
  req.id = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Log request start
  logger.info({
    request_id: req.id,
    method: req.method,
    url: req.url,
    user_agent: req.headers['user-agent'],
    ip: req.ip,
    user_id: req.user?.id || req.session?.userId
  }, 'Request started');

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info({
      request_id: req.id,
      method: req.method,
      url: req.url,
      status_code: res.statusCode,
      duration_ms: duration,
      content_length: res.get('content-length'),
      user_id: req.user?.id || req.session?.userId
    }, 'Request completed');

    // Log performance metrics
    errorHandler.logPerformance(`${req.method} ${req.url}`, duration, {
      status_code: res.statusCode,
      content_length: res.get('content-length')
    });
  });

  next();
};

// Health check for error handler
export const getErrorHandlerHealth = () => {
  return {
    status: 'healthy',
    error_stats: errorHandler.getErrorStats(),
    uptime: process.uptime(),
    memory_usage: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };
};

export default {
  errorMiddleware,
  notFoundMiddleware,
  timeoutMiddleware,
  requestLoggerMiddleware,
  getErrorHandlerHealth,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError
};