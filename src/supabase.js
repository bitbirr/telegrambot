import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      db: {
        schema: 'public',
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'x-application-name': 'eqabo-telegram-bot',
        },
      },
      // Add timeout configurations to prevent ETIMEDOUT errors
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
        timeout: 30000, // 30 seconds
      },
      // Configure fetch options for better timeout handling
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          timeout: 30000, // 30 seconds timeout
          signal: AbortSignal.timeout(30000), // Abort after 30 seconds
        });
      }
    });
    console.log('✅ Supabase client initialized successfully with timeout configurations');
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error.message);
  }
} else {
  console.warn('⚠️ Supabase credentials not found. Database features will be disabled.');
}

export default supabase;