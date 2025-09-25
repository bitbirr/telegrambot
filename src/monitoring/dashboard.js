import { logger, errorHandler } from '../services/productionLogger.js';
import resilienceService from '../services/resilienceService.js';

class MonitoringDashboard {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        by_endpoint: new Map(),
        by_method: new Map(),
        response_times: []
      },
      users: {
        active_sessions: new Set(),
        total_interactions: 0,
        unique_users: new Set()
      },
      system: {
        start_time: Date.now(),
        last_health_check: null,
        alerts: []
      },
      telegram: {
        messages_sent: 0,
        messages_received: 0,
        commands_processed: 0,
        errors: 0
      },
      external_services: {
        openai_calls: 0,
        supabase_queries: 0,
        api_errors: new Map()
      }
    };
    
    this.thresholds = {
      response_time_warning: 1000, // ms
      response_time_critical: 5000, // ms
      error_rate_warning: 0.05, // 5%
      error_rate_critical: 0.1, // 10%
      memory_warning: 0.8, // 80% of available memory
      memory_critical: 0.9 // 90% of available memory
    };
    
    // Start periodic health checks
    this.startPeriodicHealthChecks();
  }

  // Record request metrics
  recordRequest(method, endpoint, statusCode, responseTime, userId = null) {
    this.metrics.requests.total++;
    
    if (statusCode >= 200 && statusCode < 400) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }
    
    // Track by endpoint
    const endpointKey = `${method} ${endpoint}`;
    const endpointStats = this.metrics.requests.by_endpoint.get(endpointKey) || {
      count: 0,
      success: 0,
      error: 0,
      avg_response_time: 0,
      total_response_time: 0
    };
    
    endpointStats.count++;
    endpointStats.total_response_time += responseTime;
    endpointStats.avg_response_time = endpointStats.total_response_time / endpointStats.count;
    
    if (statusCode >= 200 && statusCode < 400) {
      endpointStats.success++;
    } else {
      endpointStats.error++;
    }
    
    this.metrics.requests.by_endpoint.set(endpointKey, endpointStats);
    
    // Track by method
    const methodStats = this.metrics.requests.by_method.get(method) || { count: 0, avg_response_time: 0 };
    methodStats.count++;
    methodStats.avg_response_time = ((methodStats.avg_response_time * (methodStats.count - 1)) + responseTime) / methodStats.count;
    this.metrics.requests.by_method.set(method, methodStats);
    
    // Store response times (keep last 1000)
    this.metrics.requests.response_times.push({
      timestamp: Date.now(),
      response_time: responseTime,
      endpoint: endpointKey,
      status_code: statusCode
    });
    
    if (this.metrics.requests.response_times.length > 1000) {
      this.metrics.requests.response_times.shift();
    }
    
    // Track user activity
    if (userId) {
      this.metrics.users.active_sessions.add(userId);
      this.metrics.users.unique_users.add(userId);
    }
    
    // Check for alerts
    this.checkAlerts(responseTime, statusCode);
  }

  // Record Telegram bot metrics
  recordTelegramActivity(type, details = {}) {
    switch (type) {
      case 'message_sent':
        this.metrics.telegram.messages_sent++;
        break;
      case 'message_received':
        this.metrics.telegram.messages_received++;
        break;
      case 'command_processed':
        this.metrics.telegram.commands_processed++;
        break;
      case 'error':
        this.metrics.telegram.errors++;
        break;
    }
    
    // Log user interaction
    if (details.userId) {
      this.metrics.users.total_interactions++;
      this.metrics.users.unique_users.add(details.userId);
      errorHandler.logUserInteraction(details.userId, type, details);
    }
  }

  // Record external service calls
  recordExternalServiceCall(service, success = true, responseTime = 0) {
    switch (service) {
      case 'openai':
        this.metrics.external_services.openai_calls++;
        break;
      case 'supabase':
        this.metrics.external_services.supabase_queries++;
        break;
    }
    
    if (!success) {
      const errorCount = this.metrics.external_services.api_errors.get(service) || 0;
      this.metrics.external_services.api_errors.set(service, errorCount + 1);
    }
    
    // Log performance
    errorHandler.logPerformance(`${service}_api_call`, responseTime, { success });
  }

  // Check for alerts based on thresholds
  checkAlerts(responseTime, statusCode) {
    const now = Date.now();
    
    // Response time alerts
    if (responseTime > this.thresholds.response_time_critical) {
      this.addAlert('critical', 'High response time detected', {
        response_time: responseTime,
        threshold: this.thresholds.response_time_critical
      });
    } else if (responseTime > this.thresholds.response_time_warning) {
      this.addAlert('warning', 'Elevated response time detected', {
        response_time: responseTime,
        threshold: this.thresholds.response_time_warning
      });
    }
    
    // Error rate alerts
    const errorRate = this.getErrorRate();
    if (errorRate > this.thresholds.error_rate_critical) {
      this.addAlert('critical', 'High error rate detected', {
        error_rate: errorRate,
        threshold: this.thresholds.error_rate_critical
      });
    } else if (errorRate > this.thresholds.error_rate_warning) {
      this.addAlert('warning', 'Elevated error rate detected', {
        error_rate: errorRate,
        threshold: this.thresholds.error_rate_warning
      });
    }
    
    // Memory usage alerts
    const memoryUsage = process.memoryUsage();
    const memoryUtilization = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    if (memoryUtilization > this.thresholds.memory_critical) {
      this.addAlert('critical', 'Critical memory usage detected', {
        memory_utilization: memoryUtilization,
        heap_used: memoryUsage.heapUsed,
        heap_total: memoryUsage.heapTotal
      });
    } else if (memoryUtilization > this.thresholds.memory_warning) {
      this.addAlert('warning', 'High memory usage detected', {
        memory_utilization: memoryUtilization,
        heap_used: memoryUsage.heapUsed,
        heap_total: memoryUsage.heapTotal
      });
    }
  }

  // Add alert to the system
  addAlert(level, message, details = {}) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      details,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.metrics.system.alerts.unshift(alert);
    
    // Keep only last 100 alerts
    if (this.metrics.system.alerts.length > 100) {
      this.metrics.system.alerts.pop();
    }
    
    // Log alert
    logger[level === 'critical' ? 'error' : 'warn'](alert, `Alert: ${message}`);
  }

  // Get current error rate
  getErrorRate() {
    if (this.metrics.requests.total === 0) return 0;
    return this.metrics.requests.failed / this.metrics.requests.total;
  }

  // Get average response time
  getAverageResponseTime(timeWindow = 300000) { // 5 minutes default
    const now = Date.now();
    const recentResponses = this.metrics.requests.response_times.filter(
      r => now - r.timestamp <= timeWindow
    );
    
    if (recentResponses.length === 0) return 0;
    
    const totalTime = recentResponses.reduce((sum, r) => sum + r.response_time, 0);
    return totalTime / recentResponses.length;
  }

  // Start periodic health checks
  startPeriodicHealthChecks() {
    setInterval(async () => {
      try {
        const healthStatus = await resilienceService.performHealthCheck();
        this.metrics.system.last_health_check = {
          timestamp: new Date().toISOString(),
          status: healthStatus.overall,
          details: healthStatus
        };
        
        // Clear old active sessions (older than 30 minutes)
        const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
        // Note: In a real implementation, you'd track session timestamps
        // For now, we'll clear the set periodically
        if (Date.now() % (30 * 60 * 1000) < 60000) { // Approximately every 30 minutes
          this.metrics.users.active_sessions.clear();
        }
        
      } catch (error) {
        logger.error({ error }, 'Health check failed');
        this.addAlert('critical', 'Health check failed', { error: error.message });
      }
    }, 60000); // Every minute
  }

  // Get comprehensive dashboard data
  getDashboardData() {
    const now = Date.now();
    const uptime = now - this.metrics.system.start_time;
    
    return {
      overview: {
        uptime_ms: uptime,
        uptime_human: this.formatUptime(uptime),
        status: this.metrics.system.last_health_check?.status || 'unknown',
        last_health_check: this.metrics.system.last_health_check?.timestamp,
        active_alerts: this.metrics.system.alerts.filter(a => !a.acknowledged).length,
        total_requests: this.metrics.requests.total,
        error_rate: this.getErrorRate(),
        avg_response_time: this.getAverageResponseTime()
      },
      requests: {
        total: this.metrics.requests.total,
        successful: this.metrics.requests.successful,
        failed: this.metrics.requests.failed,
        success_rate: this.metrics.requests.total > 0 ? 
          this.metrics.requests.successful / this.metrics.requests.total : 0,
        by_endpoint: Object.fromEntries(this.metrics.requests.by_endpoint),
        by_method: Object.fromEntries(this.metrics.requests.by_method),
        recent_response_times: this.metrics.requests.response_times.slice(-50)
      },
      users: {
        active_sessions: this.metrics.users.active_sessions.size,
        total_interactions: this.metrics.users.total_interactions,
        unique_users: this.metrics.users.unique_users.size
      },
      telegram: this.metrics.telegram,
      external_services: {
        openai_calls: this.metrics.external_services.openai_calls,
        supabase_queries: this.metrics.external_services.supabase_queries,
        api_errors: Object.fromEntries(this.metrics.external_services.api_errors)
      },
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        node_version: process.version,
        environment: process.env.NODE_ENV,
        vercel: process.env.VERCEL === '1'
      },
      alerts: this.metrics.system.alerts.slice(0, 20), // Last 20 alerts
      thresholds: this.thresholds
    };
  }

  // Format uptime in human-readable format
  formatUptime(uptimeMs) {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Acknowledge alert
  acknowledgeAlert(alertId) {
    const alert = this.metrics.system.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledged_at = new Date().toISOString();
      logger.info({ alert_id: alertId }, 'Alert acknowledged');
    }
  }

  // Reset metrics (useful for testing or maintenance)
  resetMetrics() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        by_endpoint: new Map(),
        by_method: new Map(),
        response_times: []
      },
      users: {
        active_sessions: new Set(),
        total_interactions: 0,
        unique_users: new Set()
      },
      system: {
        start_time: Date.now(),
        last_health_check: null,
        alerts: []
      },
      telegram: {
        messages_sent: 0,
        messages_received: 0,
        commands_processed: 0,
        errors: 0
      },
      external_services: {
        openai_calls: 0,
        supabase_queries: 0,
        api_errors: new Map()
      }
    };
    
    logger.info('Monitoring metrics reset');
  }
}

// Create singleton instance
const monitoringDashboard = new MonitoringDashboard();

export default monitoringDashboard;
export { MonitoringDashboard };