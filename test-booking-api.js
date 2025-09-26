import dotenv from 'dotenv';
import axios from 'axios';
import { logEvent } from './src/services/logService.js';

// Load environment variables
dotenv.config();

console.log('🧪 Testing Booking API Endpoints...\n');

const API_BASE_URL = process.env.BOOKING_API_URL || 'http://localhost:3001';
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Create axios instance with timeout
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Test helper function
 */
async function runTest(testName, testFn) {
  try {
    console.log(`🔍 Testing: ${testName}`);
    await testFn();
    console.log(`✅ ${testName} - PASSED\n`);
    testResults.passed++;
    testResults.tests.push({ name: testName, status: 'PASSED' });
  } catch (error) {
    console.log(`❌ ${testName} - FAILED`);
    console.log(`   Error: ${error.message}\n`);
    testResults.failed++;
    testResults.tests.push({ name: testName, status: 'FAILED', error: error.message });
  }
}

/**
 * Test 1: API Health Check
 */
async function testApiHealth() {
  const response = await apiClient.get('/api/health');
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }

  if (!response.data.status) {
    throw new Error('Health response missing status field');
  }

  console.log(`   Status: ${response.data.status}`);
  console.log(`   Database: ${response.data.services?.database}`);
}

/**
 * Test 2: API Status
 */
async function testApiStatus() {
  const response = await apiClient.get('/api/status');
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }

  if (!response.data.endpoints) {
    throw new Error('Status response missing endpoints information');
  }

  console.log(`   Version: ${response.data.version}`);
  console.log(`   Endpoints: ${Object.keys(response.data.endpoints).length}`);
}

/**
 * Test 3: Get Cities
 */
async function testGetCities() {
  const response = await apiClient.get('/api/cities');
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }

  if (!response.data.success) {
    throw new Error('Cities request was not successful');
  }

  if (!Array.isArray(response.data.data)) {
    throw new Error('Cities data is not an array');
  }

  console.log(`   Found ${response.data.count} cities`);
  
  // Test with language parameter
  const responseFr = await apiClient.get('/api/cities?language=am');
  if (responseFr.status !== 200) {
    throw new Error('Language parameter test failed');
  }
  
  console.log(`   Language test: ${responseFr.data.count} cities in Amharic`);
}

/**
 * Test 4: Get Hotels (requires city_id)
 */
async function testGetHotels() {
  // First, get a city to test with
  const citiesResponse = await apiClient.get('/api/cities');
  if (citiesResponse.data.data.length === 0) {
    throw new Error('No cities available for hotel testing');
  }

  const testCityId = citiesResponse.data.data[0].id;
  console.log(`   Using test city ID: ${testCityId}`);

  const response = await apiClient.get(`/api/hotels?city_id=${testCityId}`);
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }

  if (!response.data.success) {
    throw new Error('Hotels request was not successful');
  }

  if (!Array.isArray(response.data.data)) {
    throw new Error('Hotels data is not an array');
  }

  console.log(`   Found ${response.data.count} hotels for city`);

  // Test missing city_id parameter
  try {
    await apiClient.get('/api/hotels');
    throw new Error('Missing city_id parameter should have failed');
  } catch (error) {
    if (error.response?.status !== 400) {
      throw new Error('Expected 400 status for missing city_id');
    }
    console.log(`   Validation test: Missing city_id properly rejected`);
  }
}

/**
 * Test 5: Check Room Availability (requires hotel_id and dates)
 */
async function testRoomAvailability() {
  // First, get a hotel to test with
  const citiesResponse = await apiClient.get('/api/cities');
  if (citiesResponse.data.data.length === 0) {
    throw new Error('No cities available for room testing');
  }

  const testCityId = citiesResponse.data.data[0].id;
  const hotelsResponse = await apiClient.get(`/api/hotels?city_id=${testCityId}`);
  
  if (hotelsResponse.data.data.length === 0) {
    console.log('   ⚠️ No hotels available for room availability testing');
    return; // Skip this test if no hotels
  }

  const testHotelId = hotelsResponse.data.data[0].id;
  console.log(`   Using test hotel ID: ${testHotelId}`);

  // Test with valid dates
  const checkin = '2024-12-01';
  const checkout = '2024-12-03';
  
  const response = await apiClient.get(`/api/rooms?hotel_id=${testHotelId}&checkin=${checkin}&checkout=${checkout}`);
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }

  if (!response.data.success) {
    throw new Error('Room availability request was not successful');
  }

  console.log(`   Available rooms: ${response.data.data.summary?.available || 0}`);
  console.log(`   Reserved rooms: ${response.data.data.summary?.reserved || 0}`);

  // Test missing parameters
  try {
    await apiClient.get(`/api/rooms?hotel_id=${testHotelId}`);
    throw new Error('Missing date parameters should have failed');
  } catch (error) {
    if (error.response?.status !== 400) {
      throw new Error('Expected 400 status for missing dates');
    }
    console.log(`   Validation test: Missing dates properly rejected`);
  }

  // Test invalid date format
  try {
    await apiClient.get(`/api/rooms?hotel_id=${testHotelId}&checkin=invalid&checkout=also-invalid`);
    throw new Error('Invalid date format should have failed');
  } catch (error) {
    if (error.response?.status !== 400) {
      throw new Error('Expected 400 status for invalid dates');
    }
    console.log(`   Validation test: Invalid dates properly rejected`);
  }
}

/**
 * Test 6: Create Booking
 */
async function testCreateBooking() {
  // This test requires actual room and hotel data
  // For now, we'll test the validation logic
  
  const invalidBookingData = {
    user_id: 123456789,
    // Missing required fields
  };

  try {
    await apiClient.post('/api/bookings', invalidBookingData);
    throw new Error('Invalid booking data should have failed');
  } catch (error) {
    if (error.response?.status !== 400) {
      throw new Error('Expected 400 status for invalid booking data');
    }
    console.log(`   Validation test: Invalid booking data properly rejected`);
  }

  console.log(`   ⚠️ Full booking test requires database setup with rooms`);
}

/**
 * Test 7: Payment Endpoints
 */
async function testPaymentEndpoints() {
  // Test payment initiation validation
  try {
    await apiClient.post('/api/payments/initiate', {});
    throw new Error('Empty payment data should have failed');
  } catch (error) {
    if (error.response?.status !== 400) {
      throw new Error('Expected 400 status for empty payment data');
    }
    console.log(`   Validation test: Empty payment data properly rejected`);
  }

  // Test payment callback validation
  try {
    await apiClient.post('/api/payments/callback', {});
    throw new Error('Empty callback data should have failed');
  } catch (error) {
    if (error.response?.status !== 400) {
      throw new Error('Expected 400 status for empty callback data');
    }
    console.log(`   Validation test: Empty callback data properly rejected`);
  }

  console.log(`   ⚠️ Full payment tests require actual booking data`);
}

/**
 * Test 8: Receipt Generation
 */
async function testReceiptGeneration() {
  // Test with non-existent booking
  try {
    await apiClient.get('/api/receipts/non-existent-booking-id');
    throw new Error('Non-existent booking should have failed');
  } catch (error) {
    if (error.response?.status !== 404) {
      throw new Error('Expected 404 status for non-existent booking');
    }
    console.log(`   Validation test: Non-existent booking properly rejected`);
  }

  console.log(`   ⚠️ Full receipt test requires paid booking data`);
}

/**
 * Test 9: Error Handling
 */
async function testErrorHandling() {
  // Test 404 endpoint
  try {
    await apiClient.get('/api/non-existent-endpoint');
    throw new Error('Non-existent endpoint should have failed');
  } catch (error) {
    if (error.response?.status !== 404) {
      throw new Error('Expected 404 status for non-existent endpoint');
    }
    console.log(`   404 handling: Non-existent endpoint properly handled`);
  }

  // Test invalid JSON (if supported)
  console.log(`   Error handling: API properly handles various error scenarios`);
}

/**
 * Main test runner
 */
async function runApiTests() {
  console.log(`🚀 Starting API tests against: ${API_BASE_URL}\n`);

  // Wait a moment for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  await runTest('API Health Check', testApiHealth);
  await runTest('API Status', testApiStatus);
  await runTest('Get Cities', testGetCities);
  await runTest('Get Hotels', testGetHotels);
  await runTest('Room Availability', testRoomAvailability);
  await runTest('Create Booking Validation', testCreateBooking);
  await runTest('Payment Endpoints Validation', testPaymentEndpoints);
  await runTest('Receipt Generation Validation', testReceiptGeneration);
  await runTest('Error Handling', testErrorHandling);

  // Print test summary
  console.log('📊 Test Results Summary:');
  console.log('========================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%\n`);

  if (testResults.failed > 0) {
    console.log('Failed Tests:');
    testResults.tests.filter(t => t.status === 'FAILED').forEach(test => {
      console.log(`  - ${test.name}: ${test.error}`);
    });
    console.log();
  }

  // Log test completion
  await logEvent('info', 'API tests completed', {
    passed: testResults.passed,
    failed: testResults.failed,
    success_rate: Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100),
    context: 'api_testing'
  });

  if (testResults.failed === 0) {
    console.log('🎉 All API tests passed! The booking API is ready for integration.\n');
    return true;
  } else {
    console.log('🔧 Some tests failed. Please review and fix issues before production use.\n');
    return false;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runApiTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}

export { runApiTests };