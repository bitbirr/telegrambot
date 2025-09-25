import pino from 'pino';
import { logEvent } from './logService.js';

// Production logger configuration for Vercel
const createProductionLogger = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = process.env.VERCEL === '1';
  
  const loggerConfig = {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    formatters: {
      level: (label) => ({ level: label }),
      log: (object) => {
        // Add Vercel-specific metadata
        if (isVercel) {
          object.vercel = {
            region: process.env.VERCEL_REGION,
            url: process.env.VERCEL_URL,
            deployment_id: process.env.VERCEL_DEPLOYMENT_ID,
            git_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA,
            git_commit_ref: process.env.VERCEL_GIT_COMMIT_REF
          };
        }
        
        // Add request context if available
        if (object.req) {
          object.request = {
            method: object.req.method,
            url: object.req.url,
            headers: {
              'user-agent': object.req.headers['user-agent'],
              'x-forwarded-for': object.req.headers['x-forwarded-for'],
              'x-real-ip': object.req.headers['x-real-ip']
            }
          };
          delete object.req;
        }
        
        return object;
      }
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res
    }
  };

  // Use JSON format in production for better log aggregation
  if (isProduction) {
    loggerConfig.transport = undefined;
  } else {
    loggerConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    };
  }

  return pino(loggerConfig);
};

const logger = createProductionLogger();

// Enhanced error handling for production
class ProductionErrorHandler {
  constructor() {
    this.logger = logger;
    this.errorCounts = new Map();
    this.lastErrors = [];
    this.maxLastErrors = 100;
  }

  // Log and track errors with context
  async logError(error, context = {}) {
    const errorKey = `${error.name}:${error.message}`;
    const count = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, count + 1);

    const errorInfo = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        count: count + 1
      },
      context,
      timestamp: new Date().toISOString(),
      environment: {
        node_env: process.env.NODE_ENV,
        vercel: process.env.VERCEL === '1',
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    // Add to recent errors list
    this.lastErrors.unshift(errorInfo);
    if (this.lastErrors.length > this.maxLastErrors) {
      this.lastErrors.pop();
    }

    // Log to console for Vercel logs
    this.logger.error(errorInfo, 'Application error occurred');

    // Log to database for persistence
    try {
      await logEvent('error', error.message, {
        error_name: error.name,
        error_stack: error.stack,
        error_code: error.code,
        context,
        count: count + 1
      });
    } catch (logError) {
      // Fallback logging if database is unavailable
      console.error('Failed to log error to database:', logError);
    }

    return errorInfo;
  }

  // Log performance metrics
  logPerformance(operation, duration, metadata = {}) {
    const perfInfo = {
      operation,
      duration_ms: duration,
      metadata,
      timestamp: new Date().toISOString(),
      memory_usage: process.memoryUsage()
    };

    this.logger.info(perfInfo, `Performance: ${operation} completed in ${duration}ms`);
  }

  // Log user interactions
  logUserInteraction(userId, action, metadata = {}) {
    const interactionInfo = {
      user_id: userId,
      action,
      metadata,
      timestamp: new Date().toISOString()
    };

    this.logger.info(interactionInfo, `User interaction: ${action}`);
  }

  // Get error statistics
  getErrorStats() {
    return {
      total_unique_errors: this.errorCounts.size,
      error_counts: Object.fromEntries(this.errorCounts),
      recent_errors: this.lastErrors.slice(0, 10),
      memory_usage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  // Clear error statistics (useful for health checks)
  clearStats() {
    this.errorCounts.clear();
    this.lastErrors = [];
  }
}

// Global error handlers for production
const errorHandler = new ProductionErrorHandler();

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  await errorHandler.logError(error, { type: 'uncaught_exception' });
  console.error('Uncaught Exception:', error);
  
  // In production, we might want to exit gracefully
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  await errorHandler.logError(error, { 
    type: 'unhandled_rejection',
    promise_info: promise.toString()
  });
  console.error('Unhandled Rejection:', reason);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');
  
  try {
    // Log shutdown event
    await logEvent('info', 'Application shutting down', {
      signal,
      uptime: process.uptime(),
      memory_usage: process.memoryUsage()
    });
    
    // Give time for final logs to be written
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { logger, errorHandler, ProductionErrorHandler };
export default logger;