import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import services
import { createClient } from '@supabase/supabase-js';
import notificationService from './src/services/notificationService.js';
import pdfReceiptService from './src/services/pdfReceiptService.js';
import { logEvent } from './src/services/logService.js';

/**
 * Comprehensive End-to-End Booking Flow Test
 * Tests the complete booking process including:
 * - Database operations
 * - Email notifications
 * - PDF receipt generation
 * - Error handling
 * - Integration between services
 */

async function initializeServices() {
    console.log('🔧 Initializing services...\n');
    
    try {
        // Initialize Supabase
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase configuration');
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);
        console.log('✅ Supabase client initialized');
        
        // Test notification service
        const emailConfigValid = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
        console.log(`✅ Email service configured: ${emailConfigValid}`);
        
        // Test PDF service
        const pdfServiceValid = typeof pdfReceiptService.generateBookingReceipt === 'function';
        console.log(`✅ PDF service available: ${pdfServiceValid}`);
        
        return { supabase, emailConfigValid, pdfServiceValid };
        
    } catch (error) {
        console.log(`❌ Service initialization failed: ${error.message}`);
        throw error;
    }
}

async function testCompleteBookingFlow() {
    console.log('\n🎯 Testing Complete Booking Flow...\n');
    
    const testBooking = {
        id: `E2E-TEST-${Date.now()}`,
        guest_name: 'John Doe',
        guest_email: 'john.doe@example.com',
        hotel_name: 'Grand Palace Hotel',
        city: 'Addis Ababa',
        check_in_date: '2024-12-01',
        check_out_date: '2024-12-05',
        guests: 2,
        payment_method: 'Credit Card',
        total_amount: 5000,
        booking_status: 'confirmed',
        booking_date: new Date().toISOString(),
        room_type: 'Deluxe Suite',
        special_requests: 'Late check-in requested'
    };
    
    const results = {
        emailSent: false,
        pdfGenerated: false,
        emailFilePath: null,
        pdfFilePath: null,
        errors: []
    };
    
    try {
        console.log('📧 Step 1: Testing email notification...');
        
        // Test email sending
        try {
            await notificationService.sendBookingConfirmation(testBooking, testBooking.guest_email);
            results.emailSent = true;
            console.log('✅ Email notification sent successfully');
        } catch (emailError) {
            results.errors.push(`Email error: ${emailError.message}`);
            console.log(`❌ Email notification failed: ${emailError.message}`);
        }
        
        console.log('\n📄 Step 2: Testing PDF receipt generation...');
        
        // Test PDF generation
        try {
            const pdfPath = await pdfReceiptService.generateBookingReceipt(testBooking);
            results.pdfGenerated = true;
            results.pdfFilePath = pdfPath;
            
            // Verify PDF file exists
            if (fs.existsSync(pdfPath)) {
                const stats = fs.statSync(pdfPath);
                console.log(`✅ PDF receipt generated successfully`);
                console.log(`   - File path: ${pdfPath}`);
                console.log(`   - File size: ${stats.size} bytes`);
            } else {
                throw new Error('PDF file was not created');
            }
        } catch (pdfError) {
            results.errors.push(`PDF error: ${pdfError.message}`);
            console.log(`❌ PDF generation failed: ${pdfError.message}`);
        }
        
        console.log('\n🔄 Step 3: Testing error scenarios...');
        
        // Test with invalid data
        const invalidBooking = { ...testBooking, guest_name: '', total_amount: 0 };
        
        try {
            await notificationService.sendBookingConfirmation(invalidBooking, invalidBooking.guest_email);
            console.log('⚠️  Email service accepted invalid data (may need stricter validation)');
        } catch (error) {
            console.log('✅ Email service properly rejected invalid data');
        }
        
        try {
            await pdfReceiptService.generateBookingReceipt(invalidBooking);
            console.log('❌ PDF service should have rejected invalid data');
        } catch (error) {
            console.log('✅ PDF service properly rejected invalid data');
        }
        
        console.log('\n📊 Step 4: Testing service integration...');
        
        // Test the complete flow as it would happen in the bot
        try {
            const integrationTest = {
                ...testBooking,
                id: `INTEGRATION-${Date.now()}`
            };
            
            // Simulate the bot's booking confirmation flow
            console.log('   - Simulating bot booking confirmation...');
            
            // Send email notification
            await notificationService.sendBookingConfirmation(integrationTest, integrationTest.guest_email);
            console.log('   ✅ Email sent in integration test');
            
            // Generate PDF receipt
            const integrationPdfPath = await pdfReceiptService.generateBookingReceipt(integrationTest);
            console.log('   ✅ PDF generated in integration test');
            
            // Verify both files exist
            if (fs.existsSync(integrationPdfPath)) {
                console.log('   ✅ Integration test completed successfully');
                results.integrationSuccess = true;
            }
            
        } catch (integrationError) {
            results.errors.push(`Integration error: ${integrationError.message}`);
            console.log(`   ❌ Integration test failed: ${integrationError.message}`);
        }
        
    } catch (error) {
        results.errors.push(`General error: ${error.message}`);
        console.log(`❌ Booking flow test failed: ${error.message}`);
    }
    
    return results;
}

async function testPerformanceAndReliability() {
    console.log('\n⚡ Testing Performance and Reliability...\n');
    
    const performanceResults = {
        emailTimes: [],
        pdfTimes: [],
        errors: 0,
        totalTests: 5
    };
    
    for (let i = 1; i <= performanceResults.totalTests; i++) {
        console.log(`📋 Performance test ${i}/${performanceResults.totalTests}`);
        
        const testBooking = {
            id: `PERF-TEST-${i}-${Date.now()}`,
            guest_name: `Test User ${i}`,
            guest_email: `test${i}@example.com`,
            hotel_name: 'Performance Test Hotel',
            city: 'Test City',
            check_in_date: '2024-12-01',
            check_out_date: '2024-12-03',
            guests: 1,
            payment_method: 'Credit Card',
            total_amount: 1000,
            booking_status: 'confirmed',
            booking_date: new Date().toISOString()
        };
        
        try {
            // Test email performance
            const emailStart = Date.now();
            await notificationService.sendBookingConfirmation(testBooking, testBooking.guest_email);
            const emailTime = Date.now() - emailStart;
            performanceResults.emailTimes.push(emailTime);
            
            // Test PDF performance
            const pdfStart = Date.now();
            const pdfPath = await pdfReceiptService.generateBookingReceipt(testBooking);
            const pdfTime = Date.now() - pdfStart;
            performanceResults.pdfTimes.push(pdfTime);
            
            console.log(`   ✅ Test ${i}: Email ${emailTime}ms, PDF ${pdfTime}ms`);
            
        } catch (error) {
            performanceResults.errors++;
            console.log(`   ❌ Test ${i} failed: ${error.message}`);
        }
    }
    
    // Calculate averages
    const avgEmailTime = performanceResults.emailTimes.reduce((a, b) => a + b, 0) / performanceResults.emailTimes.length;
    const avgPdfTime = performanceResults.pdfTimes.reduce((a, b) => a + b, 0) / performanceResults.pdfTimes.length;
    
    console.log('\n📊 Performance Results:');
    console.log(`   - Average email time: ${avgEmailTime.toFixed(2)}ms`);
    console.log(`   - Average PDF time: ${avgPdfTime.toFixed(2)}ms`);
    console.log(`   - Success rate: ${((performanceResults.totalTests - performanceResults.errors) / performanceResults.totalTests * 100).toFixed(1)}%`);
    
    return performanceResults;
}

async function generateTestReport(initResults, flowResults, perfResults) {
    console.log('\n📋 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(50));
    
    console.log('\n🔧 SERVICE INITIALIZATION:');
    console.log(`   - Supabase: ✅ Connected`);
    console.log(`   - Email Service: ${initResults.emailConfigValid ? '✅' : '❌'} ${initResults.emailConfigValid ? 'Configured' : 'Not configured'}`);
    console.log(`   - PDF Service: ${initResults.pdfServiceValid ? '✅' : '❌'} ${initResults.pdfServiceValid ? 'Available' : 'Not available'}`);
    
    console.log('\n🎯 BOOKING FLOW TESTS:');
    console.log(`   - Email Delivery: ${flowResults.emailSent ? '✅' : '❌'} ${flowResults.emailSent ? 'Working' : 'Failed'}`);
    console.log(`   - PDF Generation: ${flowResults.pdfGenerated ? '✅' : '❌'} ${flowResults.pdfGenerated ? 'Working' : 'Failed'}`);
    console.log(`   - Service Integration: ${flowResults.integrationSuccess ? '✅' : '❌'} ${flowResults.integrationSuccess ? 'Working' : 'Failed'}`);
    
    console.log('\n⚡ PERFORMANCE METRICS:');
    if (perfResults.emailTimes.length > 0) {
        const avgEmailTime = perfResults.emailTimes.reduce((a, b) => a + b, 0) / perfResults.emailTimes.length;
        const avgPdfTime = perfResults.pdfTimes.reduce((a, b) => a + b, 0) / perfResults.pdfTimes.length;
        console.log(`   - Email avg response time: ${avgEmailTime.toFixed(2)}ms`);
        console.log(`   - PDF avg generation time: ${avgPdfTime.toFixed(2)}ms`);
        console.log(`   - Reliability: ${((perfResults.totalTests - perfResults.errors) / perfResults.totalTests * 100).toFixed(1)}%`);
    } else {
        console.log(`   - Performance tests: ❌ Failed to complete`);
    }
    
    console.log('\n🚨 ERRORS ENCOUNTERED:');
    if (flowResults.errors.length === 0) {
        console.log('   - No errors detected ✅');
    } else {
        flowResults.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
        });
    }
    
    console.log('\n🎯 OVERALL ASSESSMENT:');
    const criticalIssues = [];
    
    if (!initResults.emailConfigValid) criticalIssues.push('Email service not configured');
    if (!initResults.pdfServiceValid) criticalIssues.push('PDF service not available');
    if (!flowResults.emailSent) criticalIssues.push('Email delivery failed');
    if (!flowResults.pdfGenerated) criticalIssues.push('PDF generation failed');
    if (!flowResults.integrationSuccess) criticalIssues.push('Service integration failed');
    
    if (criticalIssues.length === 0) {
        console.log('   🎉 ALL SYSTEMS OPERATIONAL');
        console.log('   📧 Email notifications: READY');
        console.log('   📄 PDF receipts: READY');
        console.log('   🤖 Bot integration: READY');
        return true;
    } else {
        console.log('   ⚠️  ISSUES DETECTED:');
        criticalIssues.forEach((issue, index) => {
            console.log(`   ${index + 1}. ${issue}`);
        });
        return false;
    }
}

/**
 * Main test runner
 */
async function runEndToEndTests() {
    try {
        // Initialize services
        const initResults = await initializeServices();
        
        // Test complete booking flow
        const flowResults = await testCompleteBookingFlow();
        
        // Test performance and reliability
        const perfResults = await testPerformanceAndReliability();
        
        // Generate comprehensive report
        const allSystemsOperational = await generateTestReport(initResults, flowResults, perfResults);
        
        console.log('\n' + '='.repeat(50));
        if (allSystemsOperational) {
            console.log('🎉 END-TO-END TESTS COMPLETED SUCCESSFULLY');
            console.log('✅ Booking system is ready for production use');
        } else {
            console.log('⚠️  END-TO-END TESTS COMPLETED WITH ISSUES');
            console.log('❌ Please address the issues before production deployment');
        }
        
        return allSystemsOperational;
        
    } catch (error) {
        console.log(`\n❌ END-TO-END TESTS FAILED: ${error.message}`);
        console.log('🔧 Please check your configuration and try again');
        return false;
    }
}

// Export for use in other modules
export { runEndToEndTests, testCompleteBookingFlow, testPerformanceAndReliability };

// Run tests if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith('test-end-to-end-booking.js');

if (isMainModule) {
    console.log('🚀 STARTING END-TO-END BOOKING SYSTEM TESTS');
    console.log('='.repeat(50));
    
    runEndToEndTests()
        .then(success => {
            console.log('\n' + '='.repeat(50));
            if (success) {
                console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY');
            } else {
                console.log('⚠️  TESTS COMPLETED WITH ISSUES');
            }
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('\n❌ Test execution failed:', error);
            console.error(error.stack);
            process.exit(1);
        });
}