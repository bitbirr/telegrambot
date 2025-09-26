#!/usr/bin/env node

/**
 * Integration Demo: WhatsApp Booking Confirmation
 * Demonstrates how to integrate WhatsApp notifications into booking flow
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

// Import services
import notificationService from './src/services/notificationService.js';

console.log('🏨 WhatsApp Booking Confirmation Demo');
console.log('====================================\n');

/**
 * Simulate a booking confirmation scenario
 */
async function demonstrateBookingConfirmation() {
    // Sample booking data that would come from your booking system
    const bookingData = {
        id: 'BK' + Date.now(),
        hotel_name: 'eQabo Grand Hotel',
        guest_name: 'Ahmed Hassan',
        guest_email: 'ahmed.hassan@email.com',
        guest_phone: '+251911234567', // Ethiopian phone number
        check_in: '2024-12-25',
        check_out: '2024-12-28',
        rooms: 2,
        guests: 4,
        total_price: '450',
        booking_status: 'Confirmed',
        payment_method: 'Credit Card',
        city: 'Addis Ababa',
        created_at: new Date().toISOString()
    };

    console.log('📋 Booking Details:');
    console.log(`   Booking ID: ${bookingData.id}`);
    console.log(`   Guest: ${bookingData.guest_name}`);
    console.log(`   Email: ${bookingData.guest_email}`);
    console.log(`   Phone: ${bookingData.guest_phone}`);
    console.log(`   Hotel: ${bookingData.hotel_name}`);
    console.log(`   Check-in: ${bookingData.check_in}`);
    console.log(`   Check-out: ${bookingData.check_out}`);
    console.log(`   Total: $${bookingData.total_price}\n`);

    console.log('🚀 Sending Multi-Channel Booking Confirmation...\n');

    try {
        // This is how you would integrate WhatsApp notifications in your booking system
        const results = await notificationService.sendMultiChannelBookingConfirmation(
            bookingData,
            bookingData.guest_email,
            bookingData.guest_phone,
            {
                priority: 'normal',
                includeDetails: true
            }
        );

        console.log('📊 Notification Results:');
        console.log('========================');
        
        // Email Results
        console.log(`📧 Email Notification:`);
        console.log(`   Attempted: ${results.email.attempted ? '✅' : '❌'}`);
        console.log(`   Success: ${results.email.success ? '✅' : '❌'}`);
        if (results.email.attempted && !results.email.success) {
            console.log(`   Error: ${results.email.error}`);
        }
        if (results.email.messageId) {
            console.log(`   Message ID: ${results.email.messageId}`);
        }

        // WhatsApp Results
        console.log(`\n📱 WhatsApp Notification:`);
        console.log(`   Attempted: ${results.whatsapp.attempted ? '✅' : '❌'}`);
        console.log(`   Success: ${results.whatsapp.success ? '✅' : '❌'}`);
        if (results.whatsapp.attempted && !results.whatsapp.success) {
            console.log(`   Error: ${results.whatsapp.error}`);
        }
        if (results.whatsapp.messageId) {
            console.log(`   Message ID: ${results.whatsapp.messageId}`);
        }

        // Overall Results
        console.log(`\n🎯 Overall Results:`);
        console.log(`   Channels Attempted: ${results.overall.attemptedChannels}`);
        console.log(`   Channels Successful: ${results.overall.successfulChannels}`);
        console.log(`   Overall Success: ${results.overall.success ? '✅' : '❌'}`);
        
        if (results.overall.errors.length > 0) {
            console.log(`\n⚠️  Errors:`);
            results.overall.errors.forEach(error => {
                console.log(`   - ${error}`);
            });
        }

    } catch (error) {
        console.error('❌ Booking confirmation failed:', error.message);
        console.error('   Stack:', error.stack);
    }
}

/**
 * Show integration examples
 */
function showIntegrationExamples() {
    console.log('\n📚 Integration Examples:');
    console.log('========================\n');

    console.log('1️⃣ Basic Integration (existing booking flow):');
    console.log(`
// In your booking completion handler:
import notificationService from './src/services/notificationService.js';

async function completeBooking(bookingData) {
    // ... existing booking logic ...
    
    // Send notifications via multiple channels
    const results = await notificationService.sendMultiChannelBookingConfirmation(
        bookingData,
        bookingData.guest_email,
        bookingData.guest_phone
    );
    
    console.log('Notifications sent:', results.overall.success);
    return results;
}
`);

    console.log('2️⃣ Email Only (backward compatibility):');
    console.log(`
// Your existing email-only code continues to work:
const emailResult = await notificationService.sendBookingConfirmation(
    bookingData,
    bookingData.guest_email
);
`);

    console.log('3️⃣ Configuration-Based Channel Selection:');
    console.log(`
// Channels are controlled via environment variables:
// ENABLE_EMAIL_NOTIFICATIONS=true
// ENABLE_WHATSAPP_NOTIFICATIONS=true

// The system automatically uses enabled channels
const results = await notificationService.sendMultiChannelBookingConfirmation(
    bookingData,
    email,
    phone
);
`);

    console.log('4️⃣ Webhook Integration in your Express app:');
    console.log(`
// WhatsApp webhooks are already integrated in health.js:
// GET  /webhook/whatsapp        - Webhook verification
// POST /webhook/whatsapp        - Incoming events
// GET  /webhook/whatsapp/status - Service status
// POST /webhook/whatsapp/test   - Test endpoint
`);
}

/**
 * Main demo function
 */
async function runDemo() {
    try {
        await demonstrateBookingConfirmation();
        showIntegrationExamples();
        
        console.log('\n✅ WhatsApp Integration Demo Complete!');
        console.log('======================================');
        console.log('🔧 To enable WhatsApp notifications:');
        console.log('   1. Set WhatsApp credentials in .env file');
        console.log('   2. Configure webhook URL with Meta');
        console.log('   3. Your booking confirmations will automatically include WhatsApp');
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        process.exit(1);
    }
}

// Run demo if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runDemo();
}