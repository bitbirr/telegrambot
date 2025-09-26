import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import resilienceService from './services/resilienceService.js';
import { logger, errorHandler } from './services/productionLogger.js';
import { 
  errorMiddleware, 
  notFoundMiddleware, 
  requestLoggerMiddleware,
  getErrorHandlerHealth,
  AppError 
} from './middleware/errorMiddleware.js';
import monitoringDashboard from './monitoring/dashboard.js';

// Create Express app
const app = express();

// Health check cache to improve response times
const healthCache = {
  basic: { data: null, timestamp: 0, ttl: 5000 }, // 5 seconds
  detailed: { data: null, timestamp: 0, ttl: 10000 }, // 10 seconds
  metrics: { data: null, timestamp: 0, ttl: 15000 } // 15 seconds
};

function getCachedData(cacheKey) {
  const cache = healthCache[cacheKey];
  if (cache && cache.data && (Date.now() - cache.timestamp) < cache.ttl) {
    return cache.data;
  }
  return null;
}

function setCachedData(cacheKey, data) {
  const cache = healthCache[cacheKey];
  if (cache) {
    cache.data = data;
    cache.timestamp = Date.now();
  }
}

// Production middleware - optimized order for performance
app.use(compression({ 
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Balanced compression level
  filter: (req, res) => {
    // Don't compress if the request includes a cache-control: no-transform directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://eqabo.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '1mb' })); // Reduced from 10mb for better performance
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging middleware
app.use(requestLoggerMiddleware);

// Monitoring middleware to track requests
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    monitoringDashboard.recordRequest(
      req.method,
      req.route?.path || req.path,
      res.statusCode,
      responseTime,
      req.user?.id || req.headers['x-user-id']
    );
  });
  
  next();
});

// Enhanced rate limiting for production
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    errorHandler.logUserInteraction(req.ip, 'rate_limit_exceeded', {
      url: req.url,
      method: req.method,
      user_agent: req.headers['user-agent']
    });
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString()
    });
  }
});

// Apply rate limiting to all requests
app.use(limiter);

// Root endpoint for basic health checks (handles HEAD / requests)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'eQabo Telegram Bot',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Handle HEAD requests to root endpoint
app.head('/', (req, res) => {
  res.status(200).end();
});

// Basic health check endpoint with caching
app.get('/health', (req, res) => {
  // Set cache headers for client-side caching
  res.set({
    'Cache-Control': 'public, max-age=5', // Cache for 5 seconds
    'ETag': `"health-${Date.now()}"`,
    'Last-Modified': new Date().toUTCString()
  });

  // Check cache first
  const cached = getCachedData('basic');
  if (cached) {
    return res.status(200).json(cached);
  }

  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };

  // Cache the response
  setCachedData('basic', healthData);
  res.status(200).json(healthData);
});

// Detailed health check with circuit breaker status and caching
app.get('/health/detailed', async (req, res) => {
  try {
    // Check cache first
    const cached = getCachedData('detailed');
    if (cached) {
      return res.status(cached.statusCode || 200).json(cached.data);
    }

    const healthStatus = await resilienceService.performHealthCheck();
    const metrics = resilienceService.getDetailedMetrics();
    
    const detailedHealth = {
      status: healthStatus.overall,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      circuitBreakers: healthStatus,
      metrics: metrics,
      version: process.env.npm_package_version || '1.0.0'
    };
    
    // Set appropriate HTTP status code based on health
    const statusCode = healthStatus.overall === 'healthy' ? 200 : 
                      healthStatus.overall === 'degraded' ? 207 : 503;
    
    // Cache the response with status code
    setCachedData('detailed', { data: detailedHealth, statusCode });
    
    res.status(statusCode).json(detailedHealth);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error.message
    });
  }
});

// Circuit breaker metrics endpoint
app.get('/health/circuit-breakers', async (req, res) => {
  try {
    const metrics = resilienceService.getDetailedMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve circuit breaker metrics',
      message: error.message
    });
  }
});

// Reset circuit breaker endpoint (for admin use)
app.post('/health/circuit-breakers/:serviceName/reset', (req, res) => {
  try {
    const { serviceName } = req.params;
    resilienceService.resetCircuitBreaker(serviceName);
    res.json({
      message: `Circuit breaker for ${serviceName} has been reset`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset circuit breaker',
      message: error.message
    });
  }
});

// Error statistics endpoint
app.get('/health/errors', (req, res) => {
  try {
    const errorStats = getErrorHandlerHealth();
    res.json(errorStats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve error statistics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// System metrics endpoint with caching
app.get('/health/metrics', (req, res) => {
  try {
    // Check cache first
    const cached = getCachedData('metrics');
    if (cached) {
      return res.json(cached);
    }

    const metrics = {
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu_usage: process.cpuUsage(),
        platform: process.platform,
        arch: process.arch,
        node_version: process.version,
        pid: process.pid
      },
      environment: {
        node_env: process.env.NODE_ENV,
        vercel: process.env.VERCEL === '1',
        vercel_region: process.env.VERCEL_REGION,
        vercel_url: process.env.VERCEL_URL
      },
      application: {
        version: process.env.npm_package_version || '1.0.0',
        name: process.env.npm_package_name || 'telegrambot',
        timestamp: new Date().toISOString()
      }
    };
    
    // Cache the metrics
    setCachedData('metrics', metrics);
    
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve system metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Readiness probe for Kubernetes/container orchestration
app.get('/health/ready', async (req, res) => {
  try {
    // Check if all critical services are available
    const healthStatus = await resilienceService.performHealthCheck();
    
    if (healthStatus.overall === 'healthy') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        reason: 'Critical services unavailable',
        details: healthStatus,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      reason: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Liveness probe for Kubernetes/container orchestration
app.get('/health/live', (req, res) => {
  // Simple liveness check - if the process is running, it's alive
  res.status(200).json({
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Performance monitoring endpoint
app.get('/health/performance', (req, res) => {
  try {
    const startTime = process.hrtime();
    
    // Simulate some work to measure performance
    setTimeout(() => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      
      res.json({
        response_time_ms: responseTime,
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage(),
        event_loop_lag: process.hrtime(),
        timestamp: new Date().toISOString()
      });
    }, 1);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to measure performance',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Comprehensive status endpoint for monitoring dashboards
app.get('/health/status', async (req, res) => {
  try {
    const healthStatus = await resilienceService.performHealthCheck();
    const errorStats = getErrorHandlerHealth();
    const metrics = resilienceService.getDetailedMetrics();
    
    const status = {
      overall_status: healthStatus.overall,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      vercel: {
        enabled: process.env.VERCEL === '1',
        region: process.env.VERCEL_REGION,
        url: process.env.VERCEL_URL,
        deployment_id: process.env.VERCEL_DEPLOYMENT_ID
      },
      health_checks: healthStatus,
      error_statistics: errorStats.error_stats,
      circuit_breakers: metrics,
      system_metrics: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        arch: process.arch,
        node_version: process.version
      }
    };
    
    const statusCode = healthStatus.overall === 'healthy' ? 200 : 
                      healthStatus.overall === 'degraded' ? 207 : 503;
    
    res.status(statusCode).json(status);
  } catch (error) {
    logger.error({ error }, 'Failed to generate comprehensive status');
    res.status(500).json({
      overall_status: 'error',
      error: 'Failed to generate status report',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Monitoring dashboard endpoint
app.get('/monitoring/dashboard', (req, res) => {
  try {
    const dashboardData = monitoringDashboard.getDashboardData();
    res.json(dashboardData);
  } catch (error) {
    logger.error({ error }, 'Failed to generate dashboard data');
    res.status(500).json({
      error: 'Failed to generate dashboard data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Real-time metrics endpoint
app.get('/monitoring/metrics/realtime', (req, res) => {
  try {
    const dashboardData = monitoringDashboard.getDashboardData();
    
    // Return only real-time metrics
    const realtimeMetrics = {
      timestamp: new Date().toISOString(),
      requests: {
        total: dashboardData.requests.total,
        success_rate: dashboardData.requests.success_rate,
        avg_response_time: dashboardData.overview.avg_response_time,
        recent_response_times: dashboardData.requests.recent_response_times.slice(-10)
      },
      system: {
        memory_usage: dashboardData.system.memory,
        cpu_usage: dashboardData.system.cpu,
        uptime: dashboardData.overview.uptime_ms
      },
      alerts: dashboardData.alerts.filter(a => !a.acknowledged).length,
      active_users: dashboardData.users.active_sessions
    };
    
    res.json(realtimeMetrics);
  } catch (error) {
    logger.error({ error }, 'Failed to generate real-time metrics');
    res.status(500).json({
      error: 'Failed to generate real-time metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Alerts endpoint
app.get('/monitoring/alerts', (req, res) => {
  try {
    const dashboardData = monitoringDashboard.getDashboardData();
    const { acknowledged } = req.query;
    
    let alerts = dashboardData.alerts;
    
    if (acknowledged === 'false') {
      alerts = alerts.filter(a => !a.acknowledged);
    } else if (acknowledged === 'true') {
      alerts = alerts.filter(a => a.acknowledged);
    }
    
    res.json({
      alerts,
      total: alerts.length,
      unacknowledged: dashboardData.alerts.filter(a => !a.acknowledged).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ error }, 'Failed to retrieve alerts');
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Acknowledge alert endpoint
app.post('/monitoring/alerts/:alertId/acknowledge', (req, res) => {
  try {
    const { alertId } = req.params;
    monitoringDashboard.acknowledgeAlert(alertId);
    
    res.json({
      message: 'Alert acknowledged successfully',
      alert_id: alertId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ error, alert_id: req.params.alertId }, 'Failed to acknowledge alert');
    res.status(500).json({
      error: 'Failed to acknowledge alert',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Performance analytics endpoint
app.get('/monitoring/analytics/performance', (req, res) => {
  try {
    const { timeframe = '1h' } = req.query;
    const dashboardData = monitoringDashboard.getDashboardData();
    
    // Calculate timeframe in milliseconds
    const timeframes = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    };
    
    const timeframeMs = timeframes[timeframe] || timeframes['1h'];
    const cutoffTime = Date.now() - timeframeMs;
    
    // Filter response times by timeframe
    const recentResponses = dashboardData.requests.recent_response_times
      .filter(r => r.timestamp >= cutoffTime);
    
    const analytics = {
      timeframe,
      period: {
        start: new Date(cutoffTime).toISOString(),
        end: new Date().toISOString()
      },
      requests: {
        total: recentResponses.length,
        avg_response_time: recentResponses.length > 0 ? 
          recentResponses.reduce((sum, r) => sum + r.response_time, 0) / recentResponses.length : 0,
        min_response_time: recentResponses.length > 0 ? 
          Math.min(...recentResponses.map(r => r.response_time)) : 0,
        max_response_time: recentResponses.length > 0 ? 
          Math.max(...recentResponses.map(r => r.response_time)) : 0,
        p95_response_time: this.calculatePercentile(recentResponses.map(r => r.response_time), 95),
        p99_response_time: this.calculatePercentile(recentResponses.map(r => r.response_time), 99)
      },
      endpoints: dashboardData.requests.by_endpoint,
      timestamp: new Date().toISOString()
    };
    
    res.json(analytics);
  } catch (error) {
    logger.error({ error }, 'Failed to generate performance analytics');
    res.status(500).json({
      error: 'Failed to generate performance analytics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to calculate percentiles
function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;
  
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

// Reset monitoring data endpoint (admin only)
app.post('/monitoring/reset', (req, res) => {
  try {
    // In production, you'd want to add authentication here
    const authHeader = req.headers.authorization;
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin API key required',
        timestamp: new Date().toISOString()
      });
    }
    
    monitoringDashboard.resetMetrics();
    
    res.json({
      message: 'Monitoring metrics reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ error }, 'Failed to reset monitoring metrics');
    res.status(500).json({
      error: 'Failed to reset monitoring metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use(notFoundMiddleware);

// Global error handler
app.use(errorMiddleware);

export default app;