/**
 * Notification Configuration
 * Centralized configuration for notifications and escalations
 */

export const notificationConfig = {
    // Admin Groups Configuration
    adminGroups: {
        // Main admin group for all notifications
        main: process.env.ADMIN_GROUP_ID || null,
        
        // Specialized groups for different types of notifications
        bookings: process.env.BOOKING_ADMIN_GROUP_ID || process.env.ADMIN_GROUP_ID,
        technical: process.env.TECH_ADMIN_GROUP_ID || process.env.ADMIN_GROUP_ID,
        escalations: process.env.ESCALATION_ADMIN_GROUP_ID || process.env.ADMIN_GROUP_ID,
        critical: process.env.CRITICAL_ADMIN_GROUP_ID || process.env.ADMIN_GROUP_ID
    },

    // Email Configuration
    email: {
        smtp: {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true' || false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        },
        from: {
            name: process.env.FROM_NAME || 'eQabo Hotels',
            email: process.env.FROM_EMAIL || process.env.SMTP_USER
        },
        templates: {
            booking_confirmation: {
                subject: 'Booking Confirmation - eQabo Hotel',
                priority: 'normal'
            },
            bot_failure: {
                subject: 'Critical Bot Failure Alert - eQabo',
                priority: 'high'
            },
            escalation_alert: {
                subject: 'Human Agent Required - eQabo Bot',
                priority: 'high'
            },
            system_alert: {
                subject: 'System Alert - eQabo Bot',
                priority: 'high'
            }
        }
    },

    // Telegram Configuration
    telegram: {
        botToken: process.env.BOT_TOKEN,
        apiUrl: 'https://api.telegram.org/bot',
        parseMode: 'HTML',
        disableWebPagePreview: true,
        
        // Message formatting
        formatting: {
            maxMessageLength: 4096,
            truncateLength: 200,
            useEmojis: true
        },

        // Rate limiting
        rateLimits: {
            messagesPerSecond: 30,
            messagesPerMinute: 20,
            burstLimit: 5
        }
    },

    // Notification Types and Their Settings
    notificationTypes: {
        booking_confirmation: {
            enabled: true,
            channels: ['email'],
            priority: 'normal',
            adminGroup: 'bookings',
            template: 'booking_confirmation'
        },
        
        new_booking: {
            enabled: true,
            channels: ['telegram'],
            priority: 'normal',
            adminGroup: 'bookings',
            includeDetails: true
        },
        
        ai_escalation: {
            enabled: true,
            channels: ['telegram'],
            priority: 'high',
            adminGroup: 'escalations',
            immediateAlert: true
        },
        
        critical_error: {
            enabled: true,
            channels: ['telegram', 'email'],
            priority: 'critical',
            adminGroup: 'critical',
            immediateAlert: true,
            escalateAfter: 300000 // 5 minutes
        },
        
        bot_failure: {
            enabled: true,
            channels: ['email', 'telegram'],
            priority: 'critical',
            adminGroup: 'technical',
            immediateAlert: true
        },
        
        performance_alert: {
            enabled: true,
            channels: ['telegram'],
            priority: 'medium',
            adminGroup: 'technical',
            throttle: 300000 // 5 minutes
        },
        
        security_alert: {
            enabled: true,
            channels: ['telegram', 'email'],
            priority: 'critical',
            adminGroup: 'critical',
            immediateAlert: true
        }
    },

    // Escalation Rules
    escalation: {
        triggers: {
            consecutiveFailures: 3,
            complexityThreshold: 0.8,
            responseTimeThreshold: 5000, // 5 seconds
            errorRateThreshold: 10, // errors per minute
            
            // Keywords that trigger escalation
            humanRequestKeywords: [
                'human', 'agent', 'person', 'representative', 'speak to someone',
                'talk to human', 'customer service', 'manager', 'supervisor',
                'real person', 'live agent', 'human help'
            ],
            
            bookingModificationKeywords: [
                'cancel', 'modify', 'change', 'refund', 'reschedule', 
                'update booking', 'edit reservation', 'amend booking'
            ],
            
            complaintKeywords: [
                'complaint', 'dissatisfied', 'unhappy', 'terrible', 'awful',
                'worst', 'horrible', 'disappointed', 'angry', 'frustrated',
                'unacceptable', 'poor service', 'bad experience'
            ]
        },
        
        priorities: {
            critical: {
                responseTime: 300000, // 5 minutes
                escalateAfter: 600000, // 10 minutes
                notifyChannels: ['telegram', 'email']
            },
            high: {
                responseTime: 900000, // 15 minutes
                escalateAfter: 1800000, // 30 minutes
                notifyChannels: ['telegram']
            },
            medium: {
                responseTime: 3600000, // 1 hour
                escalateAfter: 7200000, // 2 hours
                notifyChannels: ['telegram']
            },
            low: {
                responseTime: 14400000, // 4 hours
                escalateAfter: 28800000, // 8 hours
                notifyChannels: ['telegram']
            }
        }
    },

    // Monitoring Configuration
    monitoring: {
        enabled: true,
        checkInterval: 30000, // 30 seconds
        
        thresholds: {
            errorRate: 10, // errors per minute
            criticalErrors: 1, // immediate alert
            responseTime: 5000, // 5 seconds
            memoryUsage: 80, // 80% of available memory
            consecutiveFailures: 5,
            diskUsage: 90, // 90% disk usage
            cpuUsage: 85 // 85% CPU usage
        },
        
        alertCooldown: {
            critical: 300000, // 5 minutes
            high: 600000, // 10 minutes
            medium: 1800000, // 30 minutes
            low: 3600000 // 1 hour
        }
    },

    // Retry Configuration
    retry: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        initialDelay: 1000, // 1 second
        maxDelay: 30000, // 30 seconds
        
        // Retry conditions
        retryableErrors: [
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNREFUSED',
            'NETWORK_ERROR',
            'RATE_LIMITED'
        ]
    },

    // Logging Configuration
    logging: {
        enabled: true,
        level: process.env.LOG_LEVEL || 'info',
        
        // What to log
        logNotificationsSent: true,
        logNotificationsFailed: true,
        logEscalations: true,
        logMonitoringAlerts: true,
        
        // Log retention
        retentionDays: 30,
        archiveAfterDays: 90
    },

    // Feature Flags
    features: {
        enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false',
        enableTelegramNotifications: process.env.ENABLE_TELEGRAM_NOTIFICATIONS !== 'false',
        enableEscalations: process.env.ENABLE_ESCALATIONS !== 'false',
        enableMonitoring: process.env.ENABLE_MONITORING !== 'false',
        enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
        enableNotificationQueue: process.env.ENABLE_NOTIFICATION_QUEUE !== 'false'
    },

    // Development/Testing Configuration
    development: {
        // Override admin groups for testing
        testAdminGroup: process.env.TEST_ADMIN_GROUP_ID,
        
        // Disable certain notifications in development
        disableEmailInDev: process.env.NODE_ENV === 'development',
        
        // Mock external services
        mockExternalServices: process.env.MOCK_EXTERNAL_SERVICES === 'true',
        
        // Verbose logging
        verboseLogging: process.env.VERBOSE_LOGGING === 'true'
    }
};

/**
 * Get admin group ID for a specific notification type
 * @param {string} notificationType - Type of notification
 * @returns {string|null} - Admin group ID
 */
export function getAdminGroupForNotification(notificationType) {
    const config = notificationConfig.notificationTypes[notificationType];
    if (!config) {
        return notificationConfig.adminGroups.main;
    }
    
    const groupKey = config.adminGroup || 'main';
    return notificationConfig.adminGroups[groupKey] || notificationConfig.adminGroups.main;
}

/**
 * Check if a notification type is enabled
 * @param {string} notificationType - Type of notification
 * @returns {boolean} - Whether the notification is enabled
 */
export function isNotificationEnabled(notificationType) {
    const config = notificationConfig.notificationTypes[notificationType];
    return config ? config.enabled : false;
}

/**
 * Get notification channels for a type
 * @param {string} notificationType - Type of notification
 * @returns {Array} - Array of enabled channels
 */
export function getNotificationChannels(notificationType) {
    const config = notificationConfig.notificationTypes[notificationType];
    if (!config) {
        return [];
    }
    
    const channels = config.channels || [];
    return channels.filter(channel => {
        if (channel === 'email') {
            return notificationConfig.features.enableEmailNotifications;
        }
        if (channel === 'telegram') {
            return notificationConfig.features.enableTelegramNotifications;
        }
        return true;
    });
}

/**
 * Get escalation priority configuration
 * @param {string} priority - Priority level
 * @returns {Object} - Priority configuration
 */
export function getEscalationPriorityConfig(priority) {
    return notificationConfig.escalation.priorities[priority] || 
           notificationConfig.escalation.priorities.medium;
}

/**
 * Validate notification configuration
 * @returns {Object} - Validation result
 */
export function validateNotificationConfig() {
    const errors = [];
    const warnings = [];
    
    // Check required environment variables
    if (!notificationConfig.adminGroups.main) {
        warnings.push('ADMIN_GROUP_ID not configured - admin notifications will be disabled');
    }
    
    if (!notificationConfig.email.smtp.auth.user || !notificationConfig.email.smtp.auth.pass) {
        warnings.push('SMTP credentials not configured - email notifications will be disabled');
    }
    
    if (!notificationConfig.telegram.botToken) {
        errors.push('BOT_TOKEN not configured - Telegram notifications will fail');
    }
    
    // Check admin group configurations
    Object.entries(notificationConfig.adminGroups).forEach(([key, value]) => {
        if (!value && key !== 'main') {
            warnings.push(`Admin group '${key}' not configured, falling back to main group`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Helper functions
 */

// Get notification configuration for a specific type
function getNotificationConfig(type) {
  return notificationConfig.notificationTypes[type] || null;
}

// Get escalation rules
function getEscalationRules() {
  return notificationConfig.escalation;
}

// Get monitoring thresholds
function getMonitoringThresholds() {
  return notificationConfig.monitoring.thresholds;
}

// Get retry configuration
function getRetryConfig() {
  const config = notificationConfig.retry;
  return {
    ...config,
    maxRetries: config.maxAttempts,
    retryDelay: config.initialDelay
  };
}

// Get admin groups configuration
function getAdminGroups() {
  return notificationConfig.adminGroups;
}

// Get email configuration
function getEmailConfig() {
  return notificationConfig.email;
}

// Get Telegram configuration
function getTelegramConfig() {
  return notificationConfig.telegram;
}

// Validate configuration
function validateConfig() {
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'BOT_TOKEN'
  ];
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return true;
}

export default {
  ...notificationConfig,
  getNotificationConfig,
  getEscalationRules,
  getMonitoringThresholds,
  getRetryConfig,
  getAdminGroups,
  getEmailConfig,
  getTelegramConfig,
  validateConfig
};