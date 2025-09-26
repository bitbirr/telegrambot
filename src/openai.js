import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

let openai = null;

if (process.env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // Add timeout configurations to prevent ETIMEDOUT errors
      timeout: 30000, // 30 seconds timeout
      maxRetries: 3, // Retry failed requests up to 3 times
      // Configure default request options
      defaultHeaders: {
        'User-Agent': 'eqabo-telegram-bot/1.0',
      },
      // Add custom fetch with timeout handling
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          timeout: 30000, // 30 seconds timeout
          signal: AbortSignal.timeout(30000), // Abort after 30 seconds
        });
      }
    });
    console.log('✅ OpenAI client initialized successfully with timeout configurations');
  } catch (error) {
    console.error('❌ Failed to initialize OpenAI client:', error.message);
  }
} else {
  console.warn('⚠️ OpenAI API key not found. AI features will be disabled.');
}

export default openai;