#!/usr/bin/env node

/**
 * Comprehensive test suite for notification and escalation system
 * Tests email notifications, Telegram alerts, escalation logic, and monitoring
 */

import { logEvent } from './src/services/logService.js';
import notificationService from './src/services/notificationService.js';
import escalationService from './src/services/escalationService.js';
import monitoringService from './src/services/monitoringService.js';
import notificationConfig from './src/config/notificationConfig.js';

// Test configuration
const TEST_CONFIG = {
  testEmail: 'haaji.dheere@gmail.com',
  testUserId: 123456789,
  testUsername: 'test_user',
  mockBookingData: {
    id: 'booking_123',
    user_id: 123456789,
    hotel_name: 'Test Hotel',
    city: 'Test City',
    check_in_date: '25/12/2024',
    check_out_date: '27/12/2024',
    guests: 2,
    total_price: 150,
    booking_status: 'confirmed'
  }
};

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

/**
 * Test runner utility
 */
async function runTest(testName, testFunction) {
  testResults.total++;
  console.log(`\n🧪 Running: ${testName}`);
  
  try {
    await testFunction();
    testResults.passed++;
    testResults.details.push({ name: testName, status: 'PASSED', error: null });
    console.log(`✅ ${testName} - PASSED`);
  } catch (error) {
    testResults.failed++;
    testResults.details.push({ name: testName, status: 'FAILED', error: error.message });
    console.log(`❌ ${testName} - FAILED: ${error.message}`);
  }
}

/**
 * Test notification configuration
 */
async function testNotificationConfig() {
  const config = notificationConfig.getNotificationConfig('booking_confirmation');
  if (!config || !config.channels || !config.priority) {
    throw new Error('Notification configuration is invalid');
  }
  
  const escalationRules = notificationConfig.getEscalationRules();
  if (!escalationRules || !escalationRules.triggers) {
    throw new Error('Escalation rules configuration is invalid');
  }
  
  console.log('   ✓ Notification configuration validated');
  console.log('   ✓ Escalation rules configuration validated');
}

/**
 * Test notification service initialization
 */
async function testNotificationServiceInit() {
  await notificationService.initialize();
  console.log('   ✓ Notification service initialized successfully');
}

/**
 * Test booking confirmation email
 */
async function testBookingConfirmationEmail() {
  const result = await notificationService.sendBookingConfirmation(
    TEST_CONFIG.mockBookingData,
    TEST_CONFIG.testEmail
  );
  
  if (!result || !result.success) {
    // Check if it's just SMTP not configured
    if (result && result.message && result.message.includes('SMTP not configured')) {
      console.log('   ✓ Email skipped - SMTP not configured (expected in test environment)');
      return;
    }
    throw new Error(`Booking confirmation email failed: ${result ? result.error || result.message : 'Unknown error'}`);
  }
  
  console.log('   ✓ Booking confirmation email sent successfully');
}

/**
 * Test admin Telegram notifications
 */
async function testAdminTelegramNotifications() {
  // Test new booking notification
  await notificationService.sendAdminNotification('new_booking', {
    bookingId: TEST_CONFIG.mockBookingData.id,
    hotelName: TEST_CONFIG.mockBookingData.hotel_name,
    userName: TEST_CONFIG.testUsername,
    checkIn: TEST_CONFIG.mockBookingData.check_in_date,
    checkOut: TEST_CONFIG.mockBookingData.check_out_date,
    guests: TEST_CONFIG.mockBookingData.guests,
    totalPrice: TEST_CONFIG.mockBookingData.total_price
  });
  
  console.log('   ✓ New booking admin notification sent');
  
  // Test AI escalation notification
  await notificationService.sendAdminNotification('ai_escalation', {
    escalationId: 'esc_123',
    userName: TEST_CONFIG.testUsername,
    userId: TEST_CONFIG.testUserId,
    reason: 'manual_request',
    priority: 'medium',
    query: 'Test escalation query'
  });
  
  console.log('   ✓ AI escalation admin notification sent');
}

/**
 * Test critical error notifications
 */
async function testCriticalErrorNotifications() {
  await notificationService.sendCriticalErrorAlert({
    errorType: 'database_connection',
    message: 'Test critical error',
    severity: 'high',
    timestamp: new Date(),
    context: 'test_suite'
  });
  
  console.log('   ✓ Critical error notification sent');
}

/**
 * Test escalation service functionality
 */
async function testEscalationService() {
  // Test escalation trigger detection
  const shouldEscalate = await escalationService.shouldEscalate({
    userId: TEST_CONFIG.testUserId,
    username: TEST_CONFIG.testUsername,
    query: 'I want to speak to a human agent',
    failureCount: 0,
    conversationHistory: [],
    lastResponse: null
  });
  
  if (!shouldEscalate.shouldEscalate) {
    throw new Error('Escalation trigger detection failed for human request');
  }
  
  console.log('   ✓ Escalation trigger detection working');
  
  // Test escalation creation
  const escalation = await escalationService.createEscalation({
    userId: TEST_CONFIG.testUserId,
    username: TEST_CONFIG.testUsername,
    query: 'Test escalation query',
    reason: 'manual_request',
    priority: 'medium',
    details: 'Test escalation details',
    conversationHistory: [],
    metadata: { test: true }
  });
  
  if (!escalation || !escalation.id) {
    throw new Error('Escalation creation failed');
  }
  
  console.log('   ✓ Escalation creation working');
  
  // Test escalation message generation
  const message = escalationService.generateEscalationMessage(escalation);
  if (!message || message.length === 0) {
    throw new Error('Escalation message generation failed');
  }
  
  console.log('   ✓ Escalation message generation working');
}

/**
 * Test monitoring service functionality
 */
async function testMonitoringService() {
  // Test monitoring initialization
  await monitoringService.startMonitoring();
  console.log('   ✓ Monitoring service started');
  
  // Test health check
  const healthStatus = await monitoringService.performHealthCheck();
  if (!healthStatus || typeof healthStatus.overall !== 'boolean') {
    throw new Error('Health check failed');
  }
  
  console.log('   ✓ Health check working');
  
  // Test error categorization
  const category = monitoringService.categorizeError('Database connection failed');
  if (!category) {
    throw new Error('Error categorization failed');
  }
  
  console.log('   ✓ Error categorization working');
}

/**
 * Test escalation triggers
 */
async function testEscalationTriggers() {
  const testCases = [
    {
      name: 'Human request keywords',
      query: 'I want to speak to a human',
      expected: true
    },
    {
      name: 'Booking modification keywords',
      query: 'I need to cancel my booking',
      expected: true
    },
    {
      name: 'Complaint keywords',
      query: 'This is terrible service',
      expected: true
    },
    {
      name: 'Normal query',
      query: 'What hotels are available?',
      expected: false
    }
  ];
  
  for (const testCase of testCases) {
    const result = await escalationService.shouldEscalate({
      userId: TEST_CONFIG.testUserId,
      username: TEST_CONFIG.testUsername,
      query: testCase.query,
      failureCount: 0,
      conversationHistory: [],
      lastResponse: null
    });
    
    if (result.shouldEscalate !== testCase.expected) {
      throw new Error(`Escalation trigger test failed for: ${testCase.name}`);
    }
  }
  
  console.log('   ✓ All escalation triggers working correctly');
}

/**
 * Test notification retry logic
 */
async function testNotificationRetry() {
  // This test simulates retry behavior by checking configuration
  const retryConfig = notificationConfig.getRetryConfig();
  if (!retryConfig || !retryConfig.maxRetries || !retryConfig.retryDelay) {
    throw new Error('Retry configuration is invalid');
  }
  
  console.log('   ✓ Notification retry configuration validated');
}

/**
 * Test logging integration
 */
async function testLoggingIntegration() {
  await logEvent('info', 'Test notification system', {
    context: 'test_suite',
    test_type: 'logging_integration',
    timestamp: new Date()
  });
  
  console.log('   ✓ Logging integration working');
}

/**
 * Main test execution
 */
async function runAllTests() {
  console.log('🚀 Starting Notification & Escalation System Tests\n');
  console.log('=' .repeat(60));
  
  // Configuration tests
  await runTest('Notification Configuration', testNotificationConfig);
  await runTest('Notification Service Initialization', testNotificationServiceInit);
  
  // Notification tests
  await runTest('Booking Confirmation Email', testBookingConfirmationEmail);
  await runTest('Admin Telegram Notifications', testAdminTelegramNotifications);
  await runTest('Critical Error Notifications', testCriticalErrorNotifications);
  
  // Escalation tests
  await runTest('Escalation Service', testEscalationService);
  await runTest('Escalation Triggers', testEscalationTriggers);
  
  // Monitoring tests
  await runTest('Monitoring Service', testMonitoringService);
  
  // Integration tests
  await runTest('Notification Retry Logic', testNotificationRetry);
  await runTest('Logging Integration', testLoggingIntegration);
  
  // Print results
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('=' .repeat(60));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.details
      .filter(test => test.status === 'FAILED')
      .forEach(test => {
        console.log(`   • ${test.name}: ${test.error}`);
      });
  }
  
  console.log('\n🎉 Notification & Escalation System Test Complete!');
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run tests
runAllTests().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});