import supabase from '../supabase.js';
import { logEvent } from './logService.js';
import notificationService from './notificationService.js';

/**
 * Monitoring Service - Watches for critical errors and system issues
 * Provides real-time monitoring and alerting capabilities
 */
class MonitoringService {
    constructor() {
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.checkInterval = 30000; // 30 seconds
        this.lastCheckTime = new Date();
        
        this.alertThresholds = {
            error_rate: 10, // errors per minute
            critical_errors: 1, // immediate alert
            response_time: 5000, // 5 seconds
            memory_usage: 80, // 80% of available memory
            consecutive_failures: 5
        };

        this.errorPatterns = {
            database_connection: /database.*connection|connection.*database|supabase.*error/i,
            api_timeout: /timeout|timed out|request timeout/i,
            memory_leak: /memory|heap|out of memory/i,
            authentication: /auth|authentication|unauthorized|forbidden/i,
            telegram_api: /telegram.*api|bot.*token|chat.*not.*found/i,
            payment_processing: /payment|stripe|billing|transaction.*failed/i
        };

        logEvent('info', 'Monitoring Service initialized', {
            context: 'monitoring_service',
            check_interval: this.checkInterval,
            alert_thresholds: this.alertThresholds
        });
    }

    /**
     * Start monitoring for critical errors
     * @returns {Promise<void>}
     */
    async startMonitoring() {
        if (this.isMonitoring) {
            logEvent('warn', 'Monitoring already active', {
                context: 'monitoring_service'
            });
            return;
        }

        this.isMonitoring = true;
        this.lastCheckTime = new Date();

        logEvent('info', 'Starting error monitoring', {
            context: 'monitoring_service',
            check_interval: this.checkInterval
        });

        // Start periodic monitoring
        this.monitoringInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, this.checkInterval);

        // Perform initial check
        await this.performHealthCheck();
    }

    /**
     * Stop monitoring
     * @returns {void}
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        logEvent('info', 'Monitoring stopped', {
            context: 'monitoring_service'
        });
    }

    /**
     * Perform comprehensive health check
     * @returns {Promise<Object>} Health status object
     */
    async performHealthCheck() {
        const healthStatus = {
            overall: true,
            checks: {
                criticalErrors: false,
                errorRates: false,
                systemPerformance: false,
                serviceAvailability: false
            },
            timestamp: new Date().toISOString()
        };

        try {
            const currentTime = new Date();
            const timeSinceLastCheck = currentTime - this.lastCheckTime;

            logEvent('debug', 'Performing health check', {
                context: 'monitoring_service',
                time_since_last_check: timeSinceLastCheck
            });

            // Check for critical errors
            try {
                await this.checkCriticalErrors();
                healthStatus.checks.criticalErrors = true;
            } catch (error) {
                healthStatus.overall = false;
                logEvent('warn', 'Critical errors check failed', { error: error.message });
            }

            // Check error rates
            try {
                await this.checkErrorRates();
                healthStatus.checks.errorRates = true;
            } catch (error) {
                healthStatus.overall = false;
                logEvent('warn', 'Error rates check failed', { error: error.message });
            }

            // Check system performance
            try {
                await this.checkSystemPerformance();
                healthStatus.checks.systemPerformance = true;
            } catch (error) {
                healthStatus.overall = false;
                logEvent('warn', 'System performance check failed', { error: error.message });
            }

            // Check service availability
            try {
                await this.checkServiceAvailability();
                healthStatus.checks.serviceAvailability = true;
            } catch (error) {
                healthStatus.overall = false;
                logEvent('warn', 'Service availability check failed', { error: error.message });
            }

            this.lastCheckTime = currentTime;
            return healthStatus;

        } catch (error) {
            healthStatus.overall = false;
            healthStatus.error = error.message;

            logEvent('error', 'Health check failed', {
                context: 'monitoring_service',
                error: error.message
            });

            // Alert about monitoring system failure
            try {
                await notificationService.sendCriticalErrorAlert({
                    level: 'critical',
                    message: `Monitoring system failure: ${error.message}`,
                    context: { monitoring_service: true },
                    timestamp: new Date().toISOString()
                });
            } catch (alertError) {
                logEvent('error', 'Failed to send monitoring alert', { error: alertError.message });
            }

            return healthStatus;
        }
    }

    /**
     * Check for critical errors in bot_logs
     * @returns {Promise<void>}
     */
    async checkCriticalErrors() {
        try {
            const { data: criticalErrors, error } = await supabase
                .from('bot_logs')
                .select('*')
                .in('level', ['error', 'critical'])
                .gte('created_at', this.lastCheckTime.toISOString())
                .order('created_at', { ascending: false });

            if (error) {
                throw new Error(`Database query error: ${error.message}`);
            }

            for (const errorLog of criticalErrors) {
                await this.processCriticalError(errorLog);
            }

            // Check if we've exceeded the critical error threshold
            if (criticalErrors.length >= this.alertThresholds.critical_errors) {
                await this.alertCriticalErrorThreshold(criticalErrors);
            }

        } catch (error) {
            logEvent('error', 'Critical error check failed', {
                context: 'monitoring_service',
                error: error.message
            });
        }
    }

    /**
     * Process individual critical error
     * @param {Object} errorLog - Error log entry
     * @returns {Promise<void>}
     */
    async processCriticalError(errorLog) {
        try {
            // Check if we've already alerted about this specific error
            const { data: existingAlert } = await supabase
                .from('notifications_log')
                .select('id')
                .eq('type', 'critical_error')
                .eq('metadata->error_message', errorLog.message)
                .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
                .single();

            if (existingAlert) {
                return; // Already alerted about this error recently
            }

            // Categorize the error
            const errorCategory = this.categorizeError(errorLog.message);
            
            // Determine priority based on error category
            const priority = this.getErrorPriority(errorCategory, errorLog.level);

            logEvent('info', 'Processing critical error', {
                context: 'monitoring_service',
                error_id: errorLog.id,
                category: errorCategory,
                priority: priority
            });

            // Send notification
            await notificationService.sendCriticalErrorAlert({
                level: errorLog.level,
                message: errorLog.message,
                context: {
                    ...errorLog.context,
                    category: errorCategory,
                    priority: priority
                },
                timestamp: errorLog.created_at
            });

            // Log the alert
            await this.logAlert({
                type: 'critical_error',
                error_id: errorLog.id,
                category: errorCategory,
                priority: priority,
                message: errorLog.message
            });

        } catch (error) {
            logEvent('error', 'Failed to process critical error', {
                context: 'monitoring_service',
                error: error.message,
                error_log_id: errorLog.id
            });
        }
    }

    /**
     * Check error rates and patterns
     * @returns {Promise<void>}
     */
    async checkErrorRates() {
        try {
            const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

            const { data: recentErrors, error } = await supabase
                .from('bot_logs')
                .select('level, message, created_at')
                .eq('level', 'error')
                .gte('created_at', oneMinuteAgo);

            if (error) {
                throw new Error(`Database query error: ${error.message}`);
            }

            const errorRate = recentErrors.length;

            if (errorRate >= this.alertThresholds.error_rate) {
                await this.alertHighErrorRate(errorRate, recentErrors);
            }

            // Check for error patterns
            await this.checkErrorPatterns(recentErrors);

        } catch (error) {
            logEvent('error', 'Error rate check failed', {
                context: 'monitoring_service',
                error: error.message
            });
        }
    }

    /**
     * Check system performance metrics
     * @returns {Promise<void>}
     */
    async checkSystemPerformance() {
        try {
            // Check response times from recent queries
            const { data: recentQueries, error } = await supabase
                .from('query_analytics')
                .select('response_time')
                .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                throw new Error(`Database query error: ${error.message}`);
            }

            if (recentQueries.length > 0) {
                const avgResponseTime = recentQueries.reduce((sum, query) => 
                    sum + query.response_time, 0) / recentQueries.length;

                if (avgResponseTime > this.alertThresholds.response_time) {
                    await this.alertSlowPerformance(avgResponseTime, recentQueries);
                }
            }

            // Check memory usage (if available)
            const memoryUsage = process.memoryUsage();
            const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

            if (memoryUsagePercent > this.alertThresholds.memory_usage) {
                await this.alertHighMemoryUsage(memoryUsagePercent, memoryUsage);
            }

        } catch (error) {
            logEvent('error', 'Performance check failed', {
                context: 'monitoring_service',
                error: error.message
            });
        }
    }

    /**
     * Check service availability
     * @returns {Promise<void>}
     */
    async checkServiceAvailability() {
        try {
            // Check database connectivity
            const { error: dbError } = await supabase
                .from('bot_logs')
                .select('id')
                .limit(1);

            if (dbError) {
                await this.alertServiceUnavailable('database', dbError.message);
            }

            // Check Telegram API connectivity (if bot token is available)
            if (process.env.BOT_TOKEN) {
                try {
                    const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/getMe`);
                    if (!response.ok) {
                        await this.alertServiceUnavailable('telegram_api', `HTTP ${response.status}`);
                    }
                } catch (telegramError) {
                    await this.alertServiceUnavailable('telegram_api', telegramError.message);
                }
            }

        } catch (error) {
            logEvent('error', 'Service availability check failed', {
                context: 'monitoring_service',
                error: error.message
            });
        }
    }

    /**
     * Categorize error based on message content
     * @param {string} errorMessage - Error message
     * @returns {string} - Error category
     */
    categorizeError(errorMessage) {
        for (const [category, pattern] of Object.entries(this.errorPatterns)) {
            if (pattern.test(errorMessage)) {
                return category;
            }
        }
        return 'unknown';
    }

    /**
     * Get error priority based on category and level
     * @param {string} category - Error category
     * @param {string} level - Error level
     * @returns {string} - Priority level
     */
    getErrorPriority(category, level) {
        const highPriorityCategories = [
            'database_connection', 'payment_processing', 'authentication'
        ];

        if (level === 'critical' || highPriorityCategories.includes(category)) {
            return 'critical';
        }

        if (level === 'error') {
            return 'high';
        }

        return 'medium';
    }

    /**
     * Alert about critical error threshold exceeded
     * @param {Array} criticalErrors - Critical errors
     * @returns {Promise<void>}
     */
    async alertCriticalErrorThreshold(criticalErrors) {
        const message = `🚨 Critical Error Threshold Exceeded

⚠️ <b>Alert:</b> ${criticalErrors.length} critical errors detected in the last monitoring cycle
⏰ <b>Time Window:</b> ${this.checkInterval / 1000} seconds
🔍 <b>Requires immediate attention</b>

Recent errors:
${criticalErrors.slice(0, 3).map(error => 
    `• ${error.level.toUpperCase()}: ${error.message.substring(0, 100)}...`
).join('\n')}`;

        await notificationService.sendAdminNotification(message, 'critical_error', {
            error_count: criticalErrors.length,
            time_window: this.checkInterval
        });
    }

    /**
     * Alert about high error rate
     * @param {number} errorRate - Errors per minute
     * @param {Array} errors - Recent errors
     * @returns {Promise<void>}
     */
    async alertHighErrorRate(errorRate, errors) {
        const message = `⚠️ <b>High Error Rate Detected</b>

📊 <b>Error Rate:</b> ${errorRate} errors/minute
🎯 <b>Threshold:</b> ${this.alertThresholds.error_rate} errors/minute
⏰ <b>Time Window:</b> Last 1 minute

🔍 <i>System may be experiencing issues</i>`;

        await notificationService.sendAdminNotification(message, 'warning', {
            error_rate: errorRate,
            threshold: this.alertThresholds.error_rate
        });
    }

    /**
     * Alert about slow performance
     * @param {number} avgResponseTime - Average response time
     * @param {Array} queries - Recent queries
     * @returns {Promise<void>}
     */
    async alertSlowPerformance(avgResponseTime, queries) {
        const message = `🐌 <b>Performance Degradation Detected</b>

⏱️ <b>Avg Response Time:</b> ${Math.round(avgResponseTime)}ms
🎯 <b>Threshold:</b> ${this.alertThresholds.response_time}ms
📊 <b>Sample Size:</b> ${queries.length} queries

🔍 <i>System performance may be degraded</i>`;

        await notificationService.sendAdminNotification(message, 'warning', {
            avg_response_time: avgResponseTime,
            threshold: this.alertThresholds.response_time,
            sample_size: queries.length
        });
    }

    /**
     * Alert about high memory usage
     * @param {number} memoryPercent - Memory usage percentage
     * @param {Object} memoryUsage - Memory usage details
     * @returns {Promise<void>}
     */
    async alertHighMemoryUsage(memoryPercent, memoryUsage) {
        const message = `🧠 <b>High Memory Usage Alert</b>

📊 <b>Memory Usage:</b> ${Math.round(memoryPercent)}%
🎯 <b>Threshold:</b> ${this.alertThresholds.memory_usage}%
💾 <b>Heap Used:</b> ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB
💾 <b>Heap Total:</b> ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB

⚠️ <i>Memory usage is approaching critical levels</i>`;

        await notificationService.sendAdminNotification(message, 'warning', {
            memory_percent: memoryPercent,
            heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024)
        });
    }

    /**
     * Alert about service unavailability
     * @param {string} service - Service name
     * @param {string} errorMessage - Error message
     * @returns {Promise<void>}
     */
    async alertServiceUnavailable(service, errorMessage) {
        const message = `🔴 <b>Service Unavailable</b>

🛠️ <b>Service:</b> ${service.toUpperCase()}
❌ <b>Error:</b> ${errorMessage}
⏰ <b>Detected at:</b> ${new Date().toLocaleString()}

🚨 <i>Service requires immediate attention</i>`;

        await notificationService.sendAdminNotification(message, 'critical_error', {
            service: service,
            error_message: errorMessage
        });
    }

    /**
     * Check for specific error patterns
     * @param {Array} errors - Recent errors
     * @returns {Promise<void>}
     */
    async checkErrorPatterns(errors) {
        const patternCounts = {};

        errors.forEach(error => {
            const category = this.categorizeError(error.message);
            patternCounts[category] = (patternCounts[category] || 0) + 1;
        });

        // Alert if we see multiple errors of the same pattern
        for (const [pattern, count] of Object.entries(patternCounts)) {
            if (count >= 3 && pattern !== 'unknown') {
                await this.alertErrorPattern(pattern, count, errors);
            }
        }
    }

    /**
     * Alert about error patterns
     * @param {string} pattern - Error pattern
     * @param {number} count - Pattern count
     * @param {Array} errors - Related errors
     * @returns {Promise<void>}
     */
    async alertErrorPattern(pattern, count, errors) {
        const message = `🔍 <b>Error Pattern Detected</b>

📊 <b>Pattern:</b> ${pattern.replace(/_/g, ' ').toUpperCase()}
🔢 <b>Occurrences:</b> ${count} times
⏰ <b>Time Window:</b> Last 1 minute

🔧 <i>Recurring issue detected - investigation recommended</i>`;

        await notificationService.sendAdminNotification(message, 'warning', {
            pattern: pattern,
            count: count,
            time_window: '1 minute'
        });
    }

    /**
     * Log monitoring alert
     * @param {Object} alertData - Alert information
     * @returns {Promise<void>}
     */
    async logAlert(alertData) {
        try {
            await supabase.from('monitoring_alerts').insert([{
                type: alertData.type,
                category: alertData.category,
                priority: alertData.priority,
                message: alertData.message,
                metadata: alertData,
                created_at: new Date().toISOString()
            }]);

        } catch (error) {
            logEvent('error', 'Failed to log monitoring alert', {
                context: 'monitoring_service',
                error: error.message
            });
        }
    }

    /**
     * Get monitoring statistics
     * @returns {Promise<Object>} - Monitoring stats
     */
    async getMonitoringStats() {
        try {
            const { data: alerts, error } = await supabase
                .from('monitoring_alerts')
                .select('type, category, priority, created_at')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            if (error) {
                throw new Error(`Stats query error: ${error.message}`);
            }

            const stats = {
                total_alerts: alerts.length,
                by_type: {},
                by_category: {},
                by_priority: {},
                is_monitoring: this.isMonitoring,
                last_check: this.lastCheckTime,
                check_interval: this.checkInterval
            };

            alerts.forEach(alert => {
                stats.by_type[alert.type] = (stats.by_type[alert.type] || 0) + 1;
                stats.by_category[alert.category] = (stats.by_category[alert.category] || 0) + 1;
                stats.by_priority[alert.priority] = (stats.by_priority[alert.priority] || 0) + 1;
            });

            return stats;

        } catch (error) {
            logEvent('error', 'Failed to get monitoring stats', {
                context: 'monitoring_service',
                error: error.message
            });
            return null;
        }
    }
}

// Export singleton instance
export default new MonitoringService();