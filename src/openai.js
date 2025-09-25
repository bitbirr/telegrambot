import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

let openai = null;

if (process.env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✅ OpenAI client initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize OpenAI client:', error.message);
  }
} else {
  console.warn('⚠️ OpenAI API key not found. AI features will be disabled.');
}

export default openai;