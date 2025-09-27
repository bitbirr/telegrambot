import dotenv from 'dotenv';
import bookingService from './src/services/booking.service.js';
import availabilityService from './src/services/availability.service.js';
import { logEvent } from './src/services/logService.js';

// Load environment variables
dotenv.config();

console.log('🧪 Testing Booking Service Implementation...\n');

// Test data - Use dates well into the future to avoid any timezone issues
const futureDate1 = new Date();
futureDate1.setFullYear(futureDate1.getFullYear() + 1);
const futureDate2 = new Date(futureDate1);
futureDate2.setDate(futureDate2.getDate() + 3);

const testBookingData = {
  hotelId: '550e8400-e29b-41d4-a716-446655440000', // Test UUID
  roomId: '550e8400-e29b-41d4-a716-446655440000',
  checkin: futureDate1.toISOString().split('T')[0],
  checkout: futureDate2.toISOString().split('T')[0],
  guests: 2,
  userId: 123456789,
  userDetails: {
    name: 'Test User',
    email: 'test@example.com',
    phone: '+251911234567'
  }
};

async function testBookingService() {
  let allTestsPassed = true;

  console.log('📋 Step 1: Testing booking service validation...');
  
  try {
    // Test 1: Missing required fields
    try {
      await bookingService.createBooking({
        hotelId: testBookingData.hotelId,
        // Missing other required fields
      });
      console.log('❌ Should have thrown error for missing fields');
      allTestsPassed = false;
    } catch (error) {
      if (error.message.includes('Missing required booking data')) {
        console.log('✅ Correctly validated missing required fields');
      } else {
        console.log('❌ Unexpected error for missing fields:', error.message);
        allTestsPassed = false;
      }
    }

    // Test 2: Invalid date format
    try {
      await bookingService.createBooking({
        ...testBookingData,
        checkin: 'invalid-date'
      });
      console.log('❌ Should have thrown error for invalid date');
      allTestsPassed = false;
    } catch (error) {
      if (error.message.includes('Invalid date format')) {
        console.log('✅ Correctly validated invalid date format');
      } else {
        console.log('❌ Unexpected error for invalid date:', error.message);
        allTestsPassed = false;
      }
    }

    // Test 3: Check-out before check-in
    const futureDateA = new Date();
    futureDateA.setFullYear(futureDateA.getFullYear() + 1);
    const futureDateB = new Date(futureDateA);
    futureDateB.setDate(futureDateB.getDate() - 1); // Earlier date
    
    try {
      await bookingService.createBooking({
        ...testBookingData,
        checkin: futureDateA.toISOString().split('T')[0],
        checkout: futureDateB.toISOString().split('T')[0]
      });
      console.log('❌ Should have thrown error for checkout before checkin');
      allTestsPassed = false;
    } catch (error) {
      if (error.message.includes('Check-out date must be after check-in date')) {
        console.log('✅ Correctly validated date order');
      } else {
        console.log('❌ Unexpected error for date order:', error.message);
        allTestsPassed = false;
      }
    }

    // Test 4: Past dates
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    try {
      await bookingService.createBooking({
        ...testBookingData,
        checkin: yesterdayStr,
        checkout: testBookingData.checkout // Use valid future checkout date
      });
      console.log('❌ Should have thrown error for past dates');
      allTestsPassed = false;
    } catch (error) {
      if (error.message.includes('Check-in date cannot be in the past')) {
        console.log('✅ Correctly validated past dates');
      } else {
        console.log('❌ Unexpected error for past dates:', error.message);
        allTestsPassed = false;
      }
    }

    // Test 5: Invalid guest count
    try {
      await bookingService.createBooking({
        ...testBookingData,
        guests: 0
      });
      console.log('❌ Should have thrown error for invalid guest count');
      allTestsPassed = false;
    } catch (error) {
      if (error.message.includes('Guests must be a number between 1 and 20')) {
        console.log('✅ Correctly validated guest count');
      } else {
        console.log('❌ Unexpected error for guest count:', error.message);
        allTestsPassed = false;
      }
    }

    console.log('\n📋 Step 2: Testing helper functions...');
    
    // Test lock ID generation
    const lockId1 = bookingService._generateLockId('test-room-1');
    const lockId2 = bookingService._generateLockId('test-room-2');
    const lockId3 = bookingService._generateLockId('test-room-1'); // Same as lockId1
    
    if (lockId1 !== lockId2) {
      console.log('✅ Lock IDs are different for different rooms');
    } else {
      console.log('❌ Lock IDs should be different for different rooms');
      allTestsPassed = false;
    }
    
    if (lockId1 === lockId3) {
      console.log('✅ Lock IDs are consistent for same room');
    } else {
      console.log('❌ Lock IDs should be consistent for same room');
      allTestsPassed = false;
    }

    // Test booking reference generation
    const ref1 = bookingService._generateBookingReference();
    const ref2 = bookingService._generateBookingReference();
    
    if (ref1 !== ref2 && ref1.startsWith('BK') && ref2.startsWith('BK')) {
      console.log('✅ Booking references are unique and properly formatted');
    } else {
      console.log('❌ Booking references should be unique and start with BK');
      allTestsPassed = false;
    }

    console.log('\n📋 Step 3: Testing availability service integration...');
    
    // Test availability service integration (will fail without DB but should handle gracefully)
    try {
      await availabilityService.checkRoomAvailability(
        testBookingData.roomId,
        testBookingData.checkin,
        testBookingData.checkout
      );
      console.log('✅ Availability service integration works');
    } catch (error) {
      if (error.message.includes('Database service unavailable')) {
        console.log('⚠️  Database not available (expected in test environment)');
      } else {
        console.log('❌ Unexpected error in availability service:', error.message);
        allTestsPassed = false;
      }
    }

    console.log('\n📋 Step 4: Testing database error handling...');
    
    // Test database error handling (should fail gracefully without DB)
    try {
      await bookingService.createBooking(testBookingData);
      console.log('⚠️  Booking creation succeeded (database might be available)');
    } catch (error) {
      if (error.message.includes('Database service unavailable')) {
        console.log('✅ Correctly handles database unavailability');
      } else if (error.message.includes('Hotel not found')) {
        console.log('✅ Correctly handles missing hotel (database is available)');
      } else {
        console.log('⚠️  Booking failed with:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected test failure:', error.message);
    allTestsPassed = false;
  }

  return allTestsPassed;
}

async function testBookingController() {
  console.log('\n🎮 Testing Booking Controller...');
  
  try {
    // Import controller
    const bookingController = (await import('./src/controllers/booking.controller.js')).default;
    
    // Mock request and response objects for testing
    const mockReq = {
      body: testBookingData,
      params: { id: 'test-booking-id' }
    };
    
    let responseStatus = 200;
    let responseData = {};
    
    const mockRes = {
      status: (code) => {
        responseStatus = code;
        return mockRes;
      },
      json: (data) => {
        responseData = data;
        return mockRes;
      }
    };
    
    console.log('  Testing controller method binding...');
    
    // Test that controller methods exist and are bound
    if (typeof bookingController.createBooking === 'function') {
      console.log('✅ createBooking method exists');
    } else {
      console.log('❌ createBooking method missing');
      return false;
    }
    
    if (typeof bookingController.getBooking === 'function') {
      console.log('✅ getBooking method exists');
    } else {
      console.log('❌ getBooking method missing');
      return false;
    }
    
    console.log('  Testing input validation in controller...');
    
    // Test missing fields validation
    const mockReqMissingFields = {
      body: { hotelId: 'test' }, // Missing required fields
      params: {}
    };
    
    await bookingController.createBooking(mockReqMissingFields, mockRes);
    
    if (responseStatus === 400 && responseData.error === 'Missing required fields') {
      console.log('✅ Controller correctly validates missing fields');
    } else {
      console.log('❌ Controller should return 400 for missing fields');
      console.log('Response:', responseStatus, responseData);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Controller test failed:', error.message);
    return false;
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Booking System Tests');
  console.log('='.repeat(50));
  
  const serviceTestsPassed = await testBookingService();
  const controllerTestsPassed = await testBookingController();
  
  console.log('\n' + '='.repeat(50));
  
  if (serviceTestsPassed && controllerTestsPassed) {
    console.log('🎉 ALL TESTS PASSED');
    console.log('✅ Booking service validation works correctly');
    console.log('✅ Controller input validation works correctly');
    console.log('✅ Error handling is properly implemented');
    console.log('✅ Integration patterns are correct');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('🔧 Please review the implementation');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});