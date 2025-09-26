import axios from 'axios';
import { logEvent } from './logService.js';
import { notificationConfig } from '../config/notificationConfig.js';
import resilienceService from './resilienceService.js';

/**
 * WhatsApp Business API Service
 * Handles sending messages via WhatsApp Business API
 */
class WhatsAppService {
    constructor() {
        this.accessToken = notificationConfig.whatsapp.accessToken;
        this.phoneNumberId = notificationConfig.whatsapp.phoneNumberId;
        this.businessAccountId = notificationConfig.whatsapp.businessAccountId;
        this.apiUrl = notificationConfig.whatsapp.apiUrl;
        this.webhookVerifyToken = notificationConfig.whatsapp.webhookVerifyToken;
        
        this.rateLimiter = {
            lastRequest: 0,
            requestCount: 0,
            burstCount: 0
        };
        
        this.initialized = false;
        
        // Initialize if credentials are available
        if (this.accessToken && this.phoneNumberId) {
            this.initialized = true;
            logEvent('info', 'WhatsApp Service initialized', {
                context: 'whatsapp_service',
                phone_number_id: this.phoneNumberId.substring(0, 8) + '...',
                business_account_id: this.businessAccountId?.substring(0, 8) + '...'
            });
        } else {
            logEvent('warn', 'WhatsApp Service not initialized - missing credentials', {
                context: 'whatsapp_service',
                has_token: !!this.accessToken,
                has_phone_number: !!this.phoneNumberId
            });
        }
    }

    /**
     * Check if WhatsApp service is properly configured
     * @returns {boolean} - Whether service is ready
     */
    isConfigured() {
        return this.initialized && this.accessToken && this.phoneNumberId;
    }

    /**
     * Apply rate limiting
     */
    async applyRateLimit() {
        const now = Date.now();
        const config = notificationConfig.whatsapp.rateLimits;
        
        // Reset counters if a minute has passed
        if (now - this.rateLimiter.lastRequest > 60000) {
            this.rateLimiter.requestCount = 0;
        }
        
        // Reset burst counter if a second has passed
        if (now - this.rateLimiter.lastRequest > 1000) {
            this.rateLimiter.burstCount = 0;
        }
        
        // Check rate limits
        if (this.rateLimiter.burstCount >= config.burstLimit) {
            const waitTime = 1000 - (now - this.rateLimiter.lastRequest);
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        if (this.rateLimiter.requestCount >= config.messagesPerMinute) {
            throw new Error('WhatsApp rate limit exceeded - too many messages per minute');
        }
        
        this.rateLimiter.lastRequest = now;
        this.rateLimiter.requestCount++;
        this.rateLimiter.burstCount++;
    }

    /**
     * Send a text message via WhatsApp Business API
     * @param {string} to - Recipient phone number (with country code)
     * @param {string} message - Message text
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - API response
     */
    async sendTextMessage(to, message, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('WhatsApp service not configured properly');
        }

        try {
            await this.applyRateLimit();

            // Clean and format phone number
            const cleanPhone = this.formatPhoneNumber(to);
            
            const payload = {
                messaging_product: 'whatsapp',
                to: cleanPhone,
                type: 'text',
                text: {
                    body: message
                }
            };

            const response = await resilienceService.executeWithRetry(
                async () => {
                    const result = await axios.post(
                        `${this.apiUrl}/${this.phoneNumberId}/messages`,
                        payload,
                        {
                            headers: {
                                'Authorization': `Bearer ${this.accessToken}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 10000
                        }
                    );
                    return result;
                },
                {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 5000,
                    exponentialBase: 2
                }
            );

            await logEvent('info', 'WhatsApp message sent successfully', {
                context: 'whatsapp_service',
                recipient: cleanPhone.substring(0, 5) + '...',
                message_id: response.data.messages?.[0]?.id,
                status: response.status
            });

            return {
                success: true,
                messageId: response.data.messages?.[0]?.id,
                status: response.data.messages?.[0]?.message_status || 'sent',
                data: response.data
            };

        } catch (error) {
            await logEvent('error', 'WhatsApp message sending failed', {
                context: 'whatsapp_service',
                recipient: to.substring(0, 5) + '...',
                error: error.message,
                status: error.response?.status,
                error_data: error.response?.data
            });

            return {
                success: false,
                error: error.message,
                status: error.response?.status || 'error',
                details: error.response?.data
            };
        }
    }

    /**
     * Send a template message (for notifications like booking confirmations)
     * @param {string} to - Recipient phone number
     * @param {string} templateName - Template name
     * @param {Object} templateData - Template parameters
     * @returns {Promise<Object>} - API response
     */
    async sendTemplateMessage(to, templateName, templateData = {}) {
        if (!this.isConfigured()) {
            throw new Error('WhatsApp service not configured properly');
        }

        try {
            await this.applyRateLimit();

            const cleanPhone = this.formatPhoneNumber(to);
            
            // For now, we'll send a formatted text message since we don't have approved templates
            // In production, you would use actual WhatsApp Business templates
            const message = this.formatBookingConfirmationMessage(templateData);
            
            return await this.sendTextMessage(cleanPhone, message);

        } catch (error) {
            await logEvent('error', 'WhatsApp template message sending failed', {
                context: 'whatsapp_service',
                recipient: to.substring(0, 5) + '...',
                template: templateName,
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                template: templateName
            };
        }
    }

    /**
     * Format phone number for WhatsApp API
     * @param {string} phoneNumber - Phone number
     * @returns {string} - Formatted phone number
     */
    formatPhoneNumber(phoneNumber) {
        // Remove all non-digit characters
        let clean = phoneNumber.replace(/\D/g, '');
        
        // If number doesn't start with country code, add a default (assuming Ethiopian +251)
        if (clean.length === 9 && !clean.startsWith('251')) {
            clean = '251' + clean;
        }
        
        return clean;
    }

    /**
     * Format booking confirmation message
     * @param {Object} bookingData - Booking information
     * @returns {string} - Formatted message
     */
    formatBookingConfirmationMessage(bookingData) {
        const emoji = notificationConfig.whatsapp.formatting.useEmojis;
        const checkIn = new Date(bookingData.check_in).toLocaleDateString();
        const checkOut = new Date(bookingData.check_out).toLocaleDateString();
        
        return `${emoji ? '🏨 ' : ''}*Booking Confirmation - eQabo Hotel*

${emoji ? '📋 ' : ''}*Booking Details:*
Booking ID: ${bookingData.id || 'N/A'}
Hotel: ${bookingData.hotel_name || 'eQabo Hotel'}
Guest: ${bookingData.guest_name || 'N/A'}
Email: ${bookingData.guest_email || 'N/A'}

${emoji ? '📅 ' : ''}*Stay Details:*
Check-in: ${checkIn}
Check-out: ${checkOut}
Rooms: ${bookingData.rooms || 1}
Guests: ${bookingData.guests || 1}

${emoji ? '💰 ' : ''}*Total Amount:* ${bookingData.total_price ? '$' + bookingData.total_price : 'Contact hotel'}

${emoji ? '📞 ' : ''}*Important Notes:*
- Please arrive with a valid ID
- Check-in: 2:00 PM
- Check-out: 12:00 PM
- For changes, contact us in advance

Thank you for choosing eQabo Hotel! ${emoji ? '🙏' : ''}

For support: https://eqabo.com/support`;
    }

    /**
     * Verify webhook request
     * @param {string} token - Verification token
     * @param {string} challenge - Challenge string
     * @returns {string|null} - Challenge if valid, null otherwise
     */
    verifyWebhook(token, challenge) {
        if (token === this.webhookVerifyToken) {
            logEvent('info', 'WhatsApp webhook verification successful', {
                context: 'whatsapp_webhook',
                challenge_length: challenge?.length || 0
            });
            return challenge;
        }
        
        logEvent('warn', 'WhatsApp webhook verification failed', {
            context: 'whatsapp_webhook',
            provided_token_length: token?.length || 0,
            expected_token_length: this.webhookVerifyToken?.length || 0
        });
        
        return null;
    }

    /**
     * Process incoming webhook event
     * @param {Object} webhookData - Webhook payload
     * @returns {Promise<void>}
     */
    async processWebhookEvent(webhookData) {
        try {
            const entry = webhookData.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            
            if (changes?.field === 'messages') {
                const messages = value?.messages || [];
                const statuses = value?.statuses || [];
                
                // Process incoming messages
                for (const message of messages) {
                    await this.handleIncomingMessage(message, value);
                }
                
                // Process message status updates
                for (const status of statuses) {
                    await this.handleMessageStatus(status, value);
                }
            }
            
        } catch (error) {
            await logEvent('error', 'WhatsApp webhook processing failed', {
                context: 'whatsapp_webhook',
                error: error.message,
                webhook_data: JSON.stringify(webhookData).substring(0, 500)
            });
        }
    }

    /**
     * Handle incoming message
     * @param {Object} message - Message data
     * @param {Object} value - Webhook value data
     */
    async handleIncomingMessage(message, value) {
        await logEvent('info', 'WhatsApp incoming message received', {
            context: 'whatsapp_webhook',
            message_id: message.id,
            from: message.from?.substring(0, 5) + '...',
            type: message.type,
            timestamp: message.timestamp
        });
        
        // Here you could implement logic to handle incoming messages
        // For example, creating support tickets or forwarding to admin group
    }

    /**
     * Handle message status update
     * @param {Object} status - Status data
     * @param {Object} value - Webhook value data
     */
    async handleMessageStatus(status, value) {
        await logEvent('info', 'WhatsApp message status update', {
            context: 'whatsapp_webhook',
            message_id: status.id,
            status: status.status,
            timestamp: status.timestamp,
            recipient_id: status.recipient_id?.substring(0, 5) + '...'
        });
        
        // Here you could update message delivery status in your database
        // or trigger notifications based on delivery status
    }
}

// Export singleton instance
export default new WhatsAppService();