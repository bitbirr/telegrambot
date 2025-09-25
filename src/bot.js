const { Telegraf, Markup } = require('telegraf');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const pino = require('pino');

// Load environment variables
dotenv.config();

// Setup logger
const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// Validate required environment variables
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!botToken) {
  logger.error('TELEGRAM_BOT_TOKEN is required but not provided in environment variables');
  process.exit(1);
}

if (!openaiApiKey) {
  logger.error('OPENAI_API_KEY is required but not provided in environment variables');
  process.exit(1);
}

// Create bot instance
const bot = new Telegraf(botToken);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// Initialize Supabase client (optional for escalation feature)
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  logger.info('Supabase client initialized');
} else {
  logger.warn('Supabase credentials not provided, escalation feature will be limited');
}

// Add middleware logger
bot.use((ctx, next) => {
  logger.info({
    userId: ctx.from?.id,
    username: ctx.from?.username,
    chatId: ctx.chat?.id,
    messageType: ctx.updateType,
    text: ctx.message?.text || ctx.callbackQuery?.data
  }, 'Bot interaction');
  return next();
});

// Sample hotel data for demonstration
const sampleHotels = [
  { id: 1, name: 'Grand Palace Hotel', location: 'City Center', rating: 5 },
  { id: 2, name: 'Comfort Inn & Suites', location: 'Airport District', rating: 4 },
  { id: 3, name: 'Boutique Garden Hotel', location: 'Historic Quarter', rating: 4 },
  { id: 4, name: 'Business Express Hotel', location: 'Business District', rating: 3 }
];

// Sample FAQs
const faqs = {
  checkin: "Check-in time is 3:00 PM and check-out is 11:00 AM.",
  cancellation: "Free cancellation is available up to 24 hours before check-in.",
  amenities: "Our hotels offer free WiFi, fitness center, business center, and complimentary breakfast.",
  pets: "Pet-friendly rooms are available with advance notice and additional fees may apply.",
  parking: "Complimentary parking is available for all guests."
};

// Helper function to get hotels (simulated)
function getHotels() {
  logger.info('Fetching hotels data');
  return sampleHotels;
}

// Helper function for AI chat
async function askAI(message) {
  try {
    logger.info({ message }, 'Processing AI request');
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful hotel assistant for eQabo.com. Provide concise, friendly responses about hotels, bookings, and travel-related questions."
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 500
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    logger.error({ error: error.message }, 'AI request failed');
    return "I'm sorry, I'm having trouble processing your request right now. Please try again later or contact our support team.";
  }
}

// User session management for booking flow
const userSessions = new Map();

// /start command with inline keyboard
bot.start((ctx) => {
  logger.info({ userId: ctx.from.id }, 'User started bot');
  
  const welcomeKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🏨 Search Hotels', 'search_hotels')],
    [Markup.button.callback('📅 Book Room', 'book_room')],
    [Markup.button.callback('❓ FAQs', 'faqs')],
    [Markup.button.callback('🤖 Talk to AI', 'talk_to_ai')],
    [Markup.button.callback('👨‍💼 Escalate to Human', 'escalate_human')]
  ]);

  ctx.reply(
    '🏨 Welcome to eQabo.com Hotel Assistant!\n\n' +
    'I\'m here to help you with your hotel needs. Please choose an option below:',
    welcomeKeyboard
  );
});

// Action handler: Search Hotels
bot.action('search_hotels', (ctx) => {
  logger.info({ userId: ctx.from.id }, 'User searching hotels');
  
  const hotels = getHotels();
  const hotelButtons = hotels.map(hotel => 
    [Markup.button.callback(`${hotel.name} (${hotel.rating}⭐)`, `hotel_${hotel.id}`)]
  );
  
  // Add back button
  hotelButtons.push([Markup.button.callback('⬅️ Back to Main Menu', 'back_to_main')]);
  
  const hotelKeyboard = Markup.inlineKeyboard(hotelButtons);
  
  ctx.editMessageText(
    '🏨 Available Hotels:\n\nSelect a hotel to view details:',
    hotelKeyboard
  );
});

// Handle individual hotel selection
sampleHotels.forEach(hotel => {
  bot.action(`hotel_${hotel.id}`, (ctx) => {
    logger.info({ userId: ctx.from.id, hotelId: hotel.id }, 'User viewing hotel details');
    
    const backKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Back to Hotels', 'search_hotels')],
      [Markup.button.callback('🏠 Main Menu', 'back_to_main')]
    ]);
    
    ctx.editMessageText(
      `🏨 ${hotel.name}\n\n` +
      `📍 Location: ${hotel.location}\n` +
      `⭐ Rating: ${hotel.rating}/5\n\n` +
      `This is a premium hotel offering excellent service and amenities. ` +
      `Perfect for both business and leisure travelers.\n\n` +
      `To book this hotel, please use the "Book Room" option from the main menu.`,
      backKeyboard
    );
  });
});

// Action handler: Book Room
bot.action('book_room', (ctx) => {
  logger.info({ userId: ctx.from.id }, 'User starting booking flow');
  
  userSessions.set(ctx.from.id, { step: 'ask_name' });
  
  const cancelKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('❌ Cancel Booking', 'back_to_main')]
  ]);
  
  ctx.editMessageText(
    '📅 Hotel Booking Process\n\n' +
    'Let\'s get your booking details. Please provide your full name:',
    cancelKeyboard
  );
});

// Action handler: FAQs
bot.action('faqs', (ctx) => {
  logger.info({ userId: ctx.from.id }, 'User viewing FAQs');
  
  const faqButtons = [
    [Markup.button.callback('🕐 Check-in/Check-out Times', 'faq_checkin')],
    [Markup.button.callback('❌ Cancellation Policy', 'faq_cancellation')],
    [Markup.button.callback('🛎️ Hotel Amenities', 'faq_amenities')],
    [Markup.button.callback('🐕 Pet Policy', 'faq_pets')],
    [Markup.button.callback('🚗 Parking Information', 'faq_parking')],
    [Markup.button.callback('⬅️ Back to Main Menu', 'back_to_main')]
  ];
  
  const faqKeyboard = Markup.inlineKeyboard(faqButtons);
  
  ctx.editMessageText(
    '❓ Frequently Asked Questions\n\n' +
    'Select a topic to get more information:',
    faqKeyboard
  );
});

// Handle FAQ selections
Object.keys(faqs).forEach(faqKey => {
  bot.action(`faq_${faqKey}`, (ctx) => {
    logger.info({ userId: ctx.from.id, faqType: faqKey }, 'User viewing FAQ');
    
    const backKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Back to FAQs', 'faqs')],
      [Markup.button.callback('🏠 Main Menu', 'back_to_main')]
    ]);
    
    ctx.editMessageText(
      `❓ FAQ Answer\n\n${faqs[faqKey]}`,
      backKeyboard
    );
  });
});

// Action handler: Talk to AI
bot.action('talk_to_ai', (ctx) => {
  logger.info({ userId: ctx.from.id }, 'User starting AI chat');
  
  userSessions.set(ctx.from.id, { step: 'ai_chat' });
  
  const cancelKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Back to Main Menu', 'back_to_main')]
  ]);
  
  ctx.editMessageText(
    '🤖 AI Assistant\n\n' +
    'Ask me anything about hotels, travel, or bookings. I\'m here to help!\n\n' +
    'Type your question:',
    cancelKeyboard
  );
});

// Action handler: Escalate to Human
bot.action('escalate_human', async (ctx) => {
  logger.info({ userId: ctx.from.id }, 'User escalating to human');
  
  try {
    // Log escalation to Supabase if available
    if (supabase) {
      const { error } = await supabase
        .from('escalations')
        .insert([
          {
            user_id: ctx.from.id,
            username: ctx.from.username || 'Unknown',
            chat_id: ctx.chat.id,
            escalated_at: new Date().toISOString(),
            status: 'pending'
          }
        ]);
      
      if (error) {
        logger.error({ error }, 'Failed to log escalation to Supabase');
      } else {
        logger.info({ userId: ctx.from.id }, 'Escalation logged to Supabase');
      }
    }
    
    // Notify admin (in a real scenario, this would send a notification)
    logger.warn({ userId: ctx.from.id, username: ctx.from.username }, 'ADMIN NOTIFICATION: User escalation request');
    
    const backKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Back to Main Menu', 'back_to_main')]
    ]);
    
    ctx.editMessageText(
      '👨‍💼 Escalated to Human Support\n\n' +
      'Your request has been escalated to our human support team. ' +
      'A representative will contact you shortly.\n\n' +
      '🕐 Expected response time: 1-2 hours during business hours\n' +
      '📧 You may also reach us at: support@eqabo.com\n\n' +
      'Thank you for your patience!',
      backKeyboard
    );
  } catch (error) {
    logger.error({ error: error.message }, 'Error during escalation process');
    ctx.reply('Sorry, there was an error processing your escalation. Please try again later.');
  }
});

// Back to main menu handler
bot.action('back_to_main', (ctx) => {
  userSessions.delete(ctx.from.id); // Clear any ongoing session
  
  const welcomeKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🏨 Search Hotels', 'search_hotels')],
    [Markup.button.callback('📅 Book Room', 'book_room')],
    [Markup.button.callback('❓ FAQs', 'faqs')],
    [Markup.button.callback('🤖 Talk to AI', 'talk_to_ai')],
    [Markup.button.callback('👨‍💼 Escalate to Human', 'escalate_human')]
  ]);

  ctx.editMessageText(
    '🏨 Welcome to eQabo.com Hotel Assistant!\n\n' +
    'I\'m here to help you with your hotel needs. Please choose an option below:',
    welcomeKeyboard
  );
});

// Handle text messages for ongoing flows
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions.get(userId);
  
  if (!session) {
    // No active session, provide help
    ctx.reply(
      'Please use /start to begin or select an option from the menu.',
      Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Main Menu', 'back_to_main')]
      ])
    );
    return;
  }
  
  const text = ctx.message.text;
  
  if (session.step === 'ask_name') {
    session.guestName = text;
    session.step = 'ask_dates';
    userSessions.set(userId, session);
    
    const cancelKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('❌ Cancel Booking', 'back_to_main')]
    ]);
    
    ctx.reply(
      `👋 Hello ${text}!\n\n` +
      'Please provide your check-in and check-out dates (format: DD/MM/YYYY - DD/MM/YYYY):',
      cancelKeyboard
    );
    
  } else if (session.step === 'ask_dates') {
    session.dates = text;
    session.step = 'ask_guests';
    userSessions.set(userId, session);
    
    const cancelKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('❌ Cancel Booking', 'back_to_main')]
    ]);
    
    ctx.reply(
      '👥 How many guests will be staying?',
      cancelKeyboard
    );
    
  } else if (session.step === 'ask_guests') {
    session.guests = text;
    
    logger.info({
      userId,
      bookingDetails: {
        guestName: session.guestName,
        dates: session.dates,
        guests: session.guests
      }
    }, 'Booking details collected');
    
    const mainMenuKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🏠 Main Menu', 'back_to_main')]
    ]);
    
    ctx.reply(
      '✅ Booking Request Submitted!\n\n' +
      `📝 Booking Details:\n` +
      `👤 Guest Name: ${session.guestName}\n` +
      `📅 Dates: ${session.dates}\n` +
      `👥 Guests: ${session.guests}\n\n` +
      'Our team will contact you shortly to confirm your reservation and process payment.\n\n' +
      '📞 For immediate assistance, call: +1-800-EQABO\n' +
      '📧 Email: bookings@eqabo.com',
      mainMenuKeyboard
    );
    
    userSessions.delete(userId); // Clear session
    
  } else if (session.step === 'ai_chat') {
    try {
      const aiResponse = await askAI(text);
      
      const continueKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❓ Ask Another Question', 'talk_to_ai')],
        [Markup.button.callback('⬅️ Back to Main Menu', 'back_to_main')]
      ]);
      
      ctx.reply(
        `🤖 AI Assistant:\n\n${aiResponse}`,
        continueKeyboard
      );
      
      userSessions.delete(userId); // Clear session after response
      
    } catch (error) {
      logger.error({ error: error.message, userId }, 'AI chat error');
      ctx.reply(
        '🤖 I apologize, but I\'m having trouble processing your request right now. ' +
        'Please try again later or use the "Escalate to Human" option for immediate assistance.'
      );
      userSessions.delete(userId);
    }
  }
});

// Error handling
bot.catch((err, ctx) => {
  logger.error({ error: err.message, userId: ctx.from?.id }, 'Bot error occurred');
  ctx.reply('Sorry, an error occurred. Please try again or contact support.');
});

// Start the bot
logger.info('Starting Telegram bot...');
bot.launch().then(() => {
  logger.info('Bot started successfully');
}).catch((error) => {
  logger.error({ error: error.message }, 'Failed to start bot');
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  bot.stop('SIGTERM');
});

module.exports = bot;