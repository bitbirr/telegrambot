// =====================================================
// eQabo.com Telegram Bot - Resilience Service
// Retry logic, circuit breaker, and error recovery
// =====================================================

import { logEvent } from './logService.js';

/**
 * Resilience Service for handling retries, circuit breakers, and error recovery
 */
class ResilienceService {
    constructor() {
        this.circuitBreakers = new Map();
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000, // 1 second
            maxDelay: 10000, // 10 seconds
            backoffMultiplier: 2
        };
        
        this.circuitBreakerConfig = {
            failureThreshold: 5,
            resetTimeout: 60000, // 1 minute
            monitoringPeriod: 300000 // 5 minutes
        };
    }

    /**
     * Execute a function with retry logic and exponential backoff
     * @param {Function} operation - The operation to retry
     * @param {string} operationName - Name for logging
     * @param {Object} options - Retry options
     * @returns {Promise} - Result of the operation
     */
    async withRetry(operation, operationName, options = {}) {
        const config = { ...this.retryConfig, ...options };
        let lastError;
        
        for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
            try {
                const result = await operation();
                
                if (attempt > 1) {
                    await logEvent('info', 'Operation succeeded after retry', {
                        operation: operationName,
                        attempt,
                        totalAttempts: config.maxRetries
                    });
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                
                await logEvent('warn', 'Operation failed, will retry', {
                    operation: operationName,
                    attempt,
                    totalAttempts: config.maxRetries,
                    error: error.message,
                    willRetry: attempt < config.maxRetries
                });
                
                // Don't wait after the last attempt
                if (attempt < config.maxRetries) {
                    const delay = Math.min(
                        config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
                        config.maxDelay
                    );
                    
                    await this.sleep(delay);
                }
            }
        }
        
        // All retries failed
        await logEvent('error', 'Operation failed after all retries', {
            operation: operationName,
            totalAttempts: config.maxRetries,
            finalError: lastError.message
        });
        
        throw lastError;
    }

    /**
     * Execute a Supabase query with retry logic
     * @param {Function} queryFunction - Supabase query function
     * @param {string} queryName - Name for logging
     * @param {Object} fallbackValue - Value to return if all retries fail
     * @returns {Promise} - Query result or fallback value
     */
    async executeSupabaseQuery(queryFunction, queryName, fallbackValue = null) {
        try {
            return await this.withRetry(
                async () => {
                    const { data, error } = await queryFunction();
                    
                    if (error) {
                        throw new Error(`Supabase error: ${error.message}`);
                    }
                    
                    return data;
                },
                `supabase_${queryName}`,
                {
                    maxRetries: 3,
                    baseDelay: 1000
                }
            );
        } catch (error) {
            await logEvent('error', 'Supabase query failed after retries', {
                query: queryName,
                error: error.message,
                fallbackUsed: fallbackValue !== null
            });
            
            return fallbackValue;
        }
    }

    /**
     * Circuit breaker implementation for external API calls
     * @param {string} serviceName - Name of the service
     * @param {Function} operation - Operation to execute
     * @returns {Promise} - Result or throws circuit breaker error
     */
    async withCircuitBreaker(serviceName, operation) {
        const breaker = this.getOrCreateCircuitBreaker(serviceName);
        
        // Check if circuit is open
        if (breaker.state === 'OPEN') {
            if (Date.now() - breaker.lastFailureTime < this.circuitBreakerConfig.resetTimeout) {
                throw new Error(`Circuit breaker is OPEN for ${serviceName}. Service temporarily unavailable.`);
            } else {
                // Try to reset to half-open
                breaker.state = 'HALF_OPEN';
                await logEvent('info', 'Circuit breaker transitioning to HALF_OPEN', {
                    service: serviceName
                });
            }
        }
        
        try {
            const result = await operation();
            
            // Success - reset circuit breaker
            if (breaker.state === 'HALF_OPEN') {
                breaker.state = 'CLOSED';
                breaker.failureCount = 0;
                await logEvent('info', 'Circuit breaker reset to CLOSED', {
                    service: serviceName
                });
            }
            
            return result;
            
        } catch (error) {
            breaker.failureCount++;
            breaker.lastFailureTime = Date.now();
            
            if (breaker.failureCount >= this.circuitBreakerConfig.failureThreshold) {
                breaker.state = 'OPEN';
                await logEvent('error', 'Circuit breaker opened due to failures', {
                    service: serviceName,
                    failureCount: breaker.failureCount,
                    threshold: this.circuitBreakerConfig.failureThreshold
                });
            }
            
            throw error;
        }
    }

    /**
     * Get or create a circuit breaker for a service
     * @param {string} serviceName - Name of the service
     * @returns {Object} - Circuit breaker state
     */
    getOrCreateCircuitBreaker(serviceName) {
        if (!this.circuitBreakers.has(serviceName)) {
            this.circuitBreakers.set(serviceName, {
                state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
                failureCount: 0,
                lastFailureTime: 0
            });
        }
        
        return this.circuitBreakers.get(serviceName);
    }

    /**
     * Execute an AI operation with circuit breaker and fallback
     * @param {Function} aiOperation - AI operation to execute
     * @param {string} fallbackMessage - Fallback message if AI fails
     * @param {string} serviceName - Name of the AI service
     * @returns {Promise<string>} - AI response or fallback message
     */
    async executeAIOperation(aiOperation, fallbackMessage, serviceName = 'openai') {
        try {
            return await this.withCircuitBreaker(serviceName, async () => {
                return await this.withRetry(
                    aiOperation,
                    `ai_${serviceName}`,
                    {
                        maxRetries: 2, // Fewer retries for AI to avoid costs
                        baseDelay: 2000
                    }
                );
            });
        } catch (error) {
            await logEvent('error', 'AI operation failed, using fallback', {
                service: serviceName,
                error: error.message,
                fallbackMessage: fallbackMessage.substring(0, 100) + '...'
            });
            
            return fallbackMessage;
        }
    }

    /**
     * Get graceful error message from knowledge base
     * @param {Function} getKnowledgeBase - Function to get knowledge base message
     * @param {string} language - Language code
     * @returns {Promise<string>} - Error message
     */
    async getGracefulErrorMessage(getKnowledgeBase, language = 'en') {
        try {
            // Try to get a graceful error message from knowledge base
            const errorMessage = await getKnowledgeBase('error.general', language);
            return errorMessage || this.getDefaultErrorMessage(language);
        } catch (error) {
            return this.getDefaultErrorMessage(language);
        }
    }

    /**
     * Get default error message in specified language
     * @param {string} language - Language code
     * @returns {string} - Default error message
     */
    getDefaultErrorMessage(language) {
        const defaultMessages = {
            en: "I'm sorry, I'm experiencing technical difficulties. Please try again in a moment.",
            am: "ይቅርታ፣ ቴክኒካዊ ችግር እያጋጠመኝ ነው። እባክዎ ትንሽ ቆይተው እንደገና ይሞክሩ።",
            so: "Waan ka xumahay, waxaan la kulmayaa dhibaatooyin farsameed. Fadlan dib u isku day daqiiqad gudaheeda.",
            or: "Dhiifama, rakkoo teeknikaa mudachaa jira. Maaloo yeroo muraasaan booda yaali.",
            ti: "ይቅሬታ፣ ቴክኒካዊ ጸገም ኣጋጢሙኒ ኣሎ። በጃኹም ቁሩብ ድሕሪ ዝሓለፈ እንደገና ፈትኑ።"
        };
        
        return defaultMessages[language] || defaultMessages.en;
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} - Promise that resolves after delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get circuit breaker status for monitoring
     * @returns {Object} - Status of all circuit breakers
     */
    getCircuitBreakerStatus() {
        const status = {};
        
        for (const [serviceName, breaker] of this.circuitBreakers.entries()) {
            status[serviceName] = {
                state: breaker.state,
                failureCount: breaker.failureCount,
                lastFailureTime: breaker.lastFailureTime,
                isHealthy: breaker.state === 'CLOSED'
            };
        }
        
        return status;
    }

    /**
     * Reset circuit breaker for a specific service
     * @param {string} serviceName - Name of the service
     */
    resetCircuitBreaker(serviceName) {
        if (this.circuitBreakers.has(serviceName)) {
            const breaker = this.circuitBreakers.get(serviceName);
            breaker.state = 'CLOSED';
            breaker.failureCount = 0;
            breaker.lastFailureTime = 0;
            
            logEvent('info', 'Circuit breaker manually reset', {
                service: serviceName
            });
        }
    }

    /**
     * Perform health check on all services with circuit breakers
     * @returns {Promise<Object>} - Health status of all services
     */
    async performHealthCheck() {
        const healthStatus = {
            timestamp: new Date().toISOString(),
            overall: 'healthy',
            services: {}
        };

        let hasUnhealthyServices = false;

        for (const [serviceName, breaker] of this.circuitBreakers.entries()) {
            const serviceHealth = {
                state: breaker.state,
                failureCount: breaker.failureCount,
                lastFailureTime: breaker.lastFailureTime,
                isHealthy: breaker.state === 'CLOSED',
                uptime: breaker.lastFailureTime ? Date.now() - breaker.lastFailureTime : null
            };

            // Determine service health status
            if (breaker.state === 'OPEN') {
                serviceHealth.status = 'critical';
                hasUnhealthyServices = true;
            } else if (breaker.state === 'HALF_OPEN') {
                serviceHealth.status = 'warning';
            } else if (breaker.failureCount > 0) {
                serviceHealth.status = 'degraded';
            } else {
                serviceHealth.status = 'healthy';
            }

            healthStatus.services[serviceName] = serviceHealth;
        }

        // Set overall health status
        if (hasUnhealthyServices) {
            healthStatus.overall = 'degraded';
        }

        await logEvent('info', 'Health check completed', {
            context: 'circuit_breaker_health',
            overall_status: healthStatus.overall,
            services_count: Object.keys(healthStatus.services).length,
            unhealthy_services: Object.keys(healthStatus.services).filter(
                name => !healthStatus.services[name].isHealthy
            ).length
        });

        return healthStatus;
    }

    /**
     * Get detailed metrics for circuit breaker monitoring
     * @returns {Object} - Detailed metrics
     */
    getDetailedMetrics() {
        const metrics = {
            timestamp: new Date().toISOString(),
            circuitBreakers: {},
            summary: {
                totalServices: this.circuitBreakers.size,
                healthyServices: 0,
                degradedServices: 0,
                criticalServices: 0
            }
        };

        for (const [serviceName, breaker] of this.circuitBreakers.entries()) {
            const serviceMetrics = {
                state: breaker.state,
                failureCount: breaker.failureCount,
                lastFailureTime: breaker.lastFailureTime,
                timeSinceLastFailure: breaker.lastFailureTime ? Date.now() - breaker.lastFailureTime : null,
                isHealthy: breaker.state === 'CLOSED',
                failureRate: breaker.failureCount / this.circuitBreakerConfig.failureThreshold,
                timeUntilReset: breaker.state === 'OPEN' ? 
                    Math.max(0, this.circuitBreakerConfig.resetTimeout - (Date.now() - breaker.lastFailureTime)) : 0
            };

            metrics.circuitBreakers[serviceName] = serviceMetrics;

            // Update summary
            if (breaker.state === 'CLOSED' && breaker.failureCount === 0) {
                metrics.summary.healthyServices++;
            } else if (breaker.state === 'OPEN') {
                metrics.summary.criticalServices++;
            } else {
                metrics.summary.degradedServices++;
            }
        }

        return metrics;
    }

    /**
     * Execute operation with enhanced monitoring and automatic recovery
     * @param {string} serviceName - Name of the service
     * @param {Function} operation - Operation to execute
     * @param {Object} options - Additional options
     * @returns {Promise} - Result or throws enhanced error
     */
    async executeWithEnhancedMonitoring(serviceName, operation, options = {}) {
        const startTime = Date.now();
        const breaker = this.getOrCreateCircuitBreaker(serviceName);
        
        try {
            const result = await this.withCircuitBreaker(serviceName, operation);
            
            const executionTime = Date.now() - startTime;
            
            await logEvent('info', 'Enhanced operation succeeded', {
                service: serviceName,
                execution_time: executionTime,
                circuit_state: breaker.state,
                failure_count: breaker.failureCount
            });
            
            return result;
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            await logEvent('error', 'Enhanced operation failed', {
                service: serviceName,
                execution_time: executionTime,
                circuit_state: breaker.state,
                failure_count: breaker.failureCount,
                error: error.message,
                will_retry: options.autoRetry && breaker.state !== 'OPEN'
            });
            
            // Auto-retry logic for non-critical failures
            if (options.autoRetry && breaker.state !== 'OPEN' && breaker.failureCount < 3) {
                await logEvent('info', 'Attempting auto-retry', {
                    service: serviceName,
                    retry_attempt: 1
                });
                
                await this.sleep(1000); // Wait 1 second before retry
                return await this.withCircuitBreaker(serviceName, operation);
            }
            
            throw error;
        }
    }
}

// Export singleton instance
const resilienceService = new ResilienceService();
export default resilienceService;