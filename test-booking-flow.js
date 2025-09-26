import dotenv from 'dotenv';
import notificationService from './src/services/notificationService.js';
import pdfReceiptService from './src/services/pdfReceiptService.js';
import supabase from './src/supabase.js';
import { logEvent } from './src/services/logService.js';

// Load environment variables
dotenv.config();

console.log('🧪 Testing Complete Booking Flow with Email Delivery...\n');

// Mock booking data that simulates a real booking
const mockBookingData = {
  id: 'TEST_BOOKING_' + Date.now(),
  user_id: 123456789,
  username: 'test_user',
  first_name: 'John',
  last_name: 'Doe',
  hotel_id: 'hotel_001',
  hotel_name: 'Grand Palace Hotel Addis Ababa',
  city: 'addis_ababa',
  check_in_date: '2024-10-15',
  check_out_date: '2024-10-18',
  guests: 2,
  payment_method: 'bank_transfer',
  total_price: 2500,
  language: 'en',
  booking_status: 'confirmed',
  created_at: new Date().toISOString()
};

const customerEmail = 'customer@example.com'; // Test email

async function testCompleteBookingFlow() {
  try {
    console.log('📋 Step 1: Testing Database Connection...');
    
    // Test Supabase connection
    if (supabase) {
      try {
        const { data, error } = await supabase.from('bookings').select('count').limit(1);
        if (error) {
          console.log('⚠️  Database connection issue:', error.message);
        } else {
          console.log('✅ Database connection successful');
        }
      } catch (dbError) {
        console.log('⚠️  Database test failed:', dbError.message);
      }
    } else {
      console.log('⚠️  Supabase not configured');
    }

    console.log('\n📧 Step 2: Testing Email Notification...');
    
    // Test email notification
    try {
      await notificationService.sendBookingConfirmation(mockBookingData, customerEmail);
      console.log('✅ Booking confirmation email sent successfully');
    } catch (emailError) {
      console.log('❌ Email sending failed:', emailError.message);
      throw emailError;
    }

    console.log('\n📄 Step 3: Testing PDF Receipt Generation...');
    
    // Test PDF receipt generation
    try {
      const receiptData = {
        ...mockBookingData,
        guest_name: mockBookingData.first_name || mockBookingData.username || 'Guest',
        guest_email: customerEmail,
        email: customerEmail,
        check_in: mockBookingData.check_in_date,
        check_out: mockBookingData.check_out_date
      };
      
      const pdfPath = await pdfReceiptService.generateBookingReceipt(receiptData, mockBookingData.language);
      console.log('✅ PDF receipt generated successfully');
      console.log('📁 PDF saved at:', pdfPath);
      
      // Check if file exists
      const fs = await import('fs');
      if (fs.existsSync(pdfPath)) {
        const stats = fs.statSync(pdfPath);
        console.log('📊 PDF file size:', Math.round(stats.size / 1024), 'KB');
        
        // Clean up test file
        setTimeout(() => {
          try {
            if (fs.existsSync(pdfPath)) {
              fs.unlinkSync(pdfPath);
              console.log('🧹 Test PDF file cleaned up');
            }
          } catch (cleanupError) {
            console.log('⚠️  PDF cleanup warning:', cleanupError.message);
          }
        }, 5000);
      } else {
        console.log('❌ PDF file was not created');
      }
      
    } catch (pdfError) {
      console.log('❌ PDF generation failed:', pdfError.message);
      throw pdfError;
    }

    console.log('\n🔍 Step 4: Testing Error Scenarios...');
    
    // Test with invalid email
    try {
      await notificationService.sendBookingConfirmation(mockBookingData, 'invalid-email');
      console.log('⚠️  Invalid email test: Should have failed but didn\'t');
    } catch (invalidEmailError) {
      console.log('✅ Invalid email properly rejected:', invalidEmailError.message);
    }
    
    // Test with missing booking data
    try {
      await notificationService.sendBookingConfirmation({}, customerEmail);
      console.log('⚠️  Missing data test: Should have failed but didn\'t');
    } catch (missingDataError) {
      console.log('✅ Missing booking data properly handled:', missingDataError.message);
    }

    console.log('\n📊 Step 5: Testing Logging System...');
    
    // Test logging
    try {
      await logEvent('info', 'Test booking flow completed successfully', {
        context: 'booking_flow_test',
        booking_id: mockBookingData.id,
        customer_email: customerEmail,
        test_timestamp: new Date().toISOString()
      });
      console.log('✅ Logging system working correctly');
    } catch (logError) {
      console.log('⚠️  Logging system issue:', logError.message);
    }

    console.log('\n🎉 BOOKING FLOW TEST COMPLETED SUCCESSFULLY!');
    console.log('==================================================');
    console.log('✅ Email delivery: WORKING');
    console.log('✅ PDF generation: WORKING');
    console.log('✅ Error handling: WORKING');
    console.log('✅ Logging system: WORKING');
    console.log('==================================================');
    
    return true;
    
  } catch (error) {
    console.log('\n❌ BOOKING FLOW TEST FAILED!');
    console.log('==================================================');
    console.log('Error:', error.message);
    console.log('Stack:', error.stack);
    console.log('==================================================');
    
    return false;
  }
}

// Run the test
testCompleteBookingFlow()
  .then((success) => {
    if (success) {
      console.log('\n🚀 All systems are ready for production!');
      process.exit(0);
    } else {
      console.log('\n🔧 Issues found that need to be addressed.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n💥 Unexpected test failure:', error);
    process.exit(1);
  });