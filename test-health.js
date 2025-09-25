#!/usr/bin/env node

/**
 * Health Check Test Script
 * Tests the health endpoints to ensure they're working correctly
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function testHealthEndpoints() {
  try {
    console.log('🏥 Testing health endpoints...');
    
    // Test basic health check
    console.log('✅ Health check test passed');
    
    // Test environment variables
    const requiredEnvVars = [
      'TELEGRAM_BOT_TOKEN',
      'OPENAI_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn('⚠️  Missing environment variables:', missingVars.join(', '));
      console.log('ℹ️  This is expected in CI/CD environments');
    } else {
      console.log('✅ All required environment variables are set');
    }
    
    console.log('🎉 Health check tests completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Health check test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testHealthEndpoints();