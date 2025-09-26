import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { logEvent } from './src/services/logService.js';

// Load environment variables
dotenv.config();

/**
 * Test SMTP connection and email delivery
 */
async function testEmailDelivery() {
    console.log('🔍 Testing Email Delivery System...\n');

    // Check environment variables
    console.log('📋 Environment Configuration:');
    console.log(`SMTP_HOST: ${process.env.SMTP_HOST}`);
    console.log(`SMTP_PORT: ${process.env.SMTP_PORT}`);
    console.log(`SMTP_USER: ${process.env.SMTP_USER}`);
    console.log(`SMTP_PASS: ${process.env.SMTP_PASS ? '***configured***' : 'NOT SET'}\n`);

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('❌ SMTP credentials not configured');
        return false;
    }

    try {
        // Create transporter with current configuration
        console.log('🔧 Creating SMTP transporter...');
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            debug: true, // Enable debug output
            logger: true // Log to console
        });

        // Test connection
        console.log('🔌 Testing SMTP connection...');
        await transporter.verify();
        console.log('✅ SMTP connection successful!\n');

        // Test email sending
        console.log('📧 Sending test email...');
        const testEmail = {
            from: `"eQabo Hotel Booking Test" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER, // Send to self for testing
            subject: 'Test Email - eQabo Receipt System',
            html: `
                <h2>🏨 eQabo Email Test</h2>
                <p>This is a test email to verify the receipt delivery system.</p>
                <p><strong>Test Time:</strong> ${new Date().toISOString()}</p>
                <p><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</p>
                <p><strong>SMTP Port:</strong> ${process.env.SMTP_PORT}</p>
                <hr>
                <p>If you receive this email, the receipt delivery system is working correctly!</p>
            `,
            text: `
                eQabo Email Test
                
                This is a test email to verify the receipt delivery system.
                Test Time: ${new Date().toISOString()}
                SMTP Host: ${process.env.SMTP_HOST}
                SMTP Port: ${process.env.SMTP_PORT}
                
                If you receive this email, the receipt delivery system is working correctly!
            `
        };

        const info = await transporter.sendMail(testEmail);
        console.log('✅ Test email sent successfully!');
        console.log(`📬 Message ID: ${info.messageId}`);
        console.log(`📤 Response: ${info.response}\n`);

        return true;

    } catch (error) {
        console.error('❌ Email delivery test failed:');
        console.error(`Error: ${error.message}`);
        console.error(`Code: ${error.code}`);
        console.error(`Command: ${error.command}\n`);

        // Provide specific troubleshooting suggestions
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Troubleshooting suggestions:');
            console.log('   - Check if SMTP host and port are correct');
            console.log('   - Verify firewall settings');
            console.log('   - Try different SMTP port (587 for TLS, 465 for SSL)');
        } else if (error.code === 'EAUTH') {
            console.log('💡 Authentication failed:');
            console.log('   - Verify SMTP username and password');
            console.log('   - Check if 2FA is enabled (may need app password)');
            console.log('   - Ensure account has SMTP access enabled');
        }

        return false;
    }
}

/**
 * Test booking confirmation email template
 */
async function testBookingConfirmationTemplate() {
    console.log('📋 Testing Booking Confirmation Email Template...\n');

    // Mock booking data
    const mockBookingData = {
        id: 'TEST_BOOKING_123',
        guestName: 'John Doe',
        guest_name: 'John Doe',
        first_name: 'John',
        hotelName: 'Test Hotel Addis Ababa',
        hotel_name: 'Test Hotel Addis Ababa',
        checkInDate: '2024-02-15',
        check_in_date: '2024-02-15',
        checkOutDate: '2024-02-17',
        check_out_date: '2024-02-17',
        rooms: 1,
        guests: 2,
        totalAmount: '$150.00',
        total_price: 150,
        city: 'Addis Ababa',
        email: process.env.SMTP_USER,
        guest_email: process.env.SMTP_USER
    };

    try {
        // Import notification service
        const { default: notificationService } = await import('./src/services/notificationService.js');
        
        console.log('📧 Sending booking confirmation email...');
        const result = await notificationService.sendBookingConfirmation(mockBookingData, process.env.SMTP_USER);
        
        if (result && result.success) {
            console.log('✅ Booking confirmation email sent successfully!');
            console.log(`📬 Message ID: ${result.messageId}`);
            return true;
        } else {
            console.error('❌ Booking confirmation email failed');
            console.error(`Error: ${result?.error || 'Unknown error'}`);
            return false;
        }

    } catch (error) {
        console.error('❌ Booking confirmation test failed:');
        console.error(error.message);
        return false;
    }
}

/**
 * Main test function
 */
async function main() {
    console.log('🚀 Starting Email Delivery System Tests\n');
    console.log('=' .repeat(50));

    try {
        // Test 1: Basic SMTP connection
        const smtpTest = await testEmailDelivery();
        
        console.log('=' .repeat(50));
        
        // Test 2: Booking confirmation template
        const templateTest = await testBookingConfirmationTemplate();
        
        console.log('=' .repeat(50));
        console.log('\n📊 Test Results Summary:');
        console.log(`SMTP Connection: ${smtpTest ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Booking Template: ${templateTest ? '✅ PASS' : '❌ FAIL'}`);
        
        if (smtpTest && templateTest) {
            console.log('\n🎉 All tests passed! Email delivery system is working correctly.');
        } else {
            console.log('\n⚠️  Some tests failed. Please check the configuration and try again.');
        }

    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
    }
}

// Run tests
main().catch(console.error);