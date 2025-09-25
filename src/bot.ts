import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!botToken) {
  console.error('TELEGRAM_BOT_TOKEN is required but not provided in environment variables');
  process.exit(1);
}

if (!openaiApiKey) {
  console.error('OPENAI_API_KEY is required but not provided in environment variables');
  process.exit(1);
}

// Create bot instance
const bot = new Telegraf(botToken);

// Handle /start command
bot.start((ctx) => {
  ctx.reply('Welcome to eQabo.com Hotel Assistant');
});

// Handle /help command
bot.help((ctx) => {
  ctx.reply('Available commands:\n/start - Get welcome message\n/help - Show this help message');
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
});

// Start the bot
console.log('Starting Telegram bot...');
bot.launch().then(() => {
  console.log('Bot started successfully');
}).catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));