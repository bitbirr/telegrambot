import express from 'express';
import rateLimit from 'express-rate-limit';
import resilienceService from './services/resilienceService.js';

// Create Express application
const app = express();

// In-memory user rate limiting code
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply to all requests
app.use(limiter);

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.send('OK');
});

// Detailed health check with circuit breaker status
app.get('/health/detailed', async (req, res) => {
  try {
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

export default app;