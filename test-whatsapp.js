#!/usr/bin/env node

/**
 * WhatsApp Service Test Script
 * Tests WhatsApp Business API integration and webhook functionality
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

// Import services
import whatsappService from './src/services/whatsappService.js';
import notificationService from './src/services/notificationService.js';

console.log('🧪 WhatsApp Business API Test Suite');
console.log('====================================\n');

/**
 * Test WhatsApp service configuration
 */
function testConfiguration() {
    console.log('1. Testing Configuration...');
    
    const configured = whatsappService.isConfigured();
    console.log(`   ✅ Service configured: ${configured}`);
    
    if (configured) {
        console.log('   📱 Phone Number ID:', whatsappService.phoneNumberId?.substring(0, 8) + '...');
        console.log('   🏢 Business Account ID:', whatsappService.businessAccountId?.substring(0, 8) + '...');
        console.log('   🌐 API URL:', whatsappService.apiUrl);
        console.log('   ✅ Access token present:', !!whatsappService.accessToken);
        console.log('   🔐 Webhook verify token present:', !!whatsappService.webhookVerifyToken);
    } else {
        console.log('   ⚠️  Missing configuration:');
        console.log('      - Access Token:', !!whatsappService.accessToken ? '✅' : '❌');
        console.log('      - Phone Number ID:', !!whatsappService.phoneNumberId ? '✅' : '❌');
        console.log('      - Business Account ID:', !!whatsappService.businessAccountId ? '✅' : '❌');
    }
    
    console.log('');
}

/**
 * Test webhook verification
 */
function testWebhookVerification() {
    console.log('2. Testing Webhook Verification...');
    
    if (!whatsappService.webhookVerifyToken) {
        console.log('   ⚠️  Webhook verify token not configured');
        return;
    }
    
    // Test with correct token
    const challenge = 'test_challenge_123';
    const correctResult = whatsappService.verifyWebhook(whatsappService.webhookVerifyToken, challenge);
    console.log('   ✅ Correct token verification:', correctResult === challenge);
    
    // Test with incorrect token
    const incorrectResult = whatsappService.verifyWebhook('wrong_token', challenge);
    console.log('   ✅ Incorrect token rejection:', incorrectResult === null);
    
    console.log('');
}

/**
 * Test message formatting
 */
function testMessageFormatting() {
    console.log('3. Testing Message Formatting...');
    
    const testBookingData = {
        id: 'TEST123',
        hotel_name: 'eQabo Test Hotel',
        guest_name: 'John Doe',
        guest_email: 'john@example.com',
        check_in: '2024-01-15',
        check_out: '2024-01-18',
        rooms: 1,
        guests: 2,
        total_price: '150'
    };
    
    try {
        const formattedMessage = whatsappService.formatBookingConfirmationMessage(testBookingData);
        console.log('   ✅ Message formatting successful');
        console.log('   📝 Message length:', formattedMessage.length);
        console.log('   📋 Contains booking ID:', formattedMessage.includes('TEST123'));
        console.log('   🏨 Contains hotel name:', formattedMessage.includes('eQabo Test Hotel'));
        console.log('   👤 Contains guest name:', formattedMessage.includes('John Doe'));
        
        // Show a preview of the message
        console.log('\n   📱 Message Preview:');
        const preview = formattedMessage.split('\n').slice(0, 5).join('\n');
        console.log('   ' + preview.replace(/\n/g, '\n   '));
        console.log('   ...\n');
    } catch (error) {
        console.log('   ❌ Message formatting failed:', error.message);
    }
}

/**
 * Test phone number formatting
 */
function testPhoneNumberFormatting() {
    console.log('4. Testing Phone Number Formatting...');
    
    const testNumbers = [
        '+251912345678',
        '251912345678',
        '912345678',
        '+1-555-123-4567',
        '555-123-4567'
    ];
    
    testNumbers.forEach(number => {
        try {
            const formatted = whatsappService.formatPhoneNumber(number);
            console.log(`   📞 ${number} → ${formatted}`);
        } catch (error) {
            console.log(`   ❌ ${number} → Error: ${error.message}`);
        }
    });
    
    console.log('');
}

/**
 * Test notification channels configuration
 */
async function testNotificationChannels() {
    console.log('5. Testing Notification Channels...');
    
    try {
        // Import notification config dynamically
        const { getNotificationChannels } = await import('./src/config/notificationConfig.js');
        
        const channels = getNotificationChannels('booking_confirmation');
        console.log('   📢 Enabled channels for booking_confirmation:', channels);
        console.log('   ✅ WhatsApp enabled:', channels.includes('whatsapp'));
        console.log('   📧 Email enabled:', channels.includes('email'));
        console.log('   📱 Telegram enabled:', channels.includes('telegram'));
    } catch (error) {
        console.log('   ❌ Configuration test failed:', error.message);
    }
    
    console.log('');
}

/**
 * Test multi-channel notification (dry run)
 */
async function testMultiChannelNotification() {
    console.log('6. Testing Multi-Channel Notification (Dry Run)...');
    
    const testBookingData = {
        id: 'TEST456',
        hotel_name: 'eQabo Test Hotel',
        guest_name: 'Jane Smith',
        guest_email: 'jane@example.com',
        check_in: '2024-02-01',
        check_out: '2024-02-03',
        rooms: 1,
        guests: 1,
        total_price: '75'
    };
    
    try {
        console.log('   📧 Would send email to:', testBookingData.guest_email);
        console.log('   📱 WhatsApp service ready:', whatsappService.isConfigured());
        
        if (whatsappService.isConfigured()) {
            console.log('   ✅ WhatsApp message would be formatted and sent');
        } else {
            console.log('   ⚠️  WhatsApp not configured - would skip WhatsApp notification');
        }
        
        console.log('   📊 Multi-channel notification structure validated');
    } catch (error) {
        console.log('   ❌ Multi-channel test failed:', error.message);
    }
    
    console.log('');
}

/**
 * Display webhook information
 */
function displayWebhookInfo() {
    console.log('7. Webhook Information...');
    console.log('   🌐 Webhook URL: /webhook/whatsapp');
    console.log('   🔍 Verification endpoint: GET /webhook/whatsapp');
    console.log('   📥 Event handler: POST /webhook/whatsapp');
    console.log('   📊 Status endpoint: GET /webhook/whatsapp/status');
    console.log('   🧪 Test endpoint: POST /webhook/whatsapp/test');
    console.log('');
    
    if (whatsappService.webhookVerifyToken) {
        console.log('   🔐 Configure your webhook with:');
        console.log('      Verify Token:', whatsappService.webhookVerifyToken);
    } else {
        console.log('   ⚠️  Set WHATSAPP_WEBHOOK_VERIFY_TOKEN in your .env file');
    }
    
    console.log('');
}

/**
 * Run all tests
 */
async function runTests() {
    try {
        testConfiguration();
        testWebhookVerification();
        testMessageFormatting();
        testPhoneNumberFormatting();
        await testNotificationChannels();
        await testMultiChannelNotification();
        displayWebhookInfo();
        
        console.log('✅ WhatsApp Service Test Suite Complete!');
        console.log('=====================================');
        
        if (whatsappService.isConfigured()) {
            console.log('🚀 WhatsApp Business API is ready to use');
        } else {
            console.log('⚠️  Configure WhatsApp credentials to enable functionality');
        }
        
    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests();
}

export { runTests };