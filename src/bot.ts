import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import { SupabaseService } from './services/supabase';
import { AdminNotificationService } from './services/admin-notification';

// Load environment variables
dotenv.config();

// Validate required environment variables
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const adminId = process.env.ADMIN_TELEGRAM_ID;

if (!botToken) {
  console.error('TELEGRAM_BOT_TOKEN is required but not provided in environment variables');
  process.exit(1);
}

if (!openaiApiKey) {
  console.error('OPENAI_API_KEY is required but not provided in environment variables');
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY are required for database functionality');
  process.exit(1);
}

// Create bot instance
const bot = new Telegraf(botToken);

// Initialize services
const supabaseService = new SupabaseService(supabaseUrl, supabaseKey);
const adminNotificationService = new AdminNotificationService(bot, adminId);

// Middleware to add Talk to Human button to responses
const addTalkToHumanButton = (text: string) => {
  return {
    text,
    ...Markup.inlineKeyboard([
      Markup.button.callback('💬 Talk to Human', 'talk_to_human')
    ])
  };
};

// Handle /start command
bot.start((ctx) => {
  ctx.reply('Welcome to eQabo.com Hotel Assistant', 
    Markup.inlineKeyboard([
      Markup.button.callback('💬 Talk to Human', 'talk_to_human')
    ])
  );
});

// Handle /help command
bot.help((ctx) => {
  ctx.reply('Available commands:\n/start - Get welcome message\n/help - Show this help message',
    Markup.inlineKeyboard([
      Markup.button.callback('💬 Talk to Human', 'talk_to_human')
    ])
  );
});

// Handle regular messages with Talk to Human button
bot.on('text', (ctx) => {
  const response = addTalkToHumanButton('I understand you need assistance. How can I help you with your hotel booking or inquiry?');
  ctx.reply(response.text, response);
});

// Handle Talk to Human button callback
bot.action('talk_to_human', async (ctx) => {
  try {
    // Answer the callback query first
    await ctx.answerCbQuery();
    
    // Get user information
    const userId = ctx.from?.id.toString();
    const username = ctx.from?.username;
    const firstName = ctx.from?.first_name;
    
    if (!userId) {
      ctx.reply('❌ Unable to process your request. Please try again.');
      return;
    }

    // Create escalation in database
    const escalationData = {
      user_id: userId,
      reason: 'User requested human assistance'
    };

    const escalation = await supabaseService.createEscalation(escalationData);
    
    if (!escalation) {
      ctx.reply('❌ Unable to process your escalation request. Please try again later.');
      return;
    }

    // Notify admin
    await adminNotificationService.notifyEscalation(escalation, {
      id: userId,
      username,
      first_name: firstName
    });

    // Confirm to user
    ctx.reply(
      '✅ Your request has been escalated to our human support team. Someone will get back to you shortly.\n\n' +
      `Reference ID: ${escalation.id}\n\n` +
      'Thank you for your patience!'
    );

  } catch (error) {
    console.error('Error handling talk to human:', error);
    ctx.reply('❌ An error occurred while processing your request. Please try again later.');
  }
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