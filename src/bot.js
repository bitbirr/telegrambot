import { Telegraf } from 'telegraf';
import { franc } from 'franc';
import supabase from './supabase.js';
import openai from './openai.js';
import { logEvent } from './services/logService.js';
import databaseService from './services/databaseService.js';
import optimizedAIService from './services/optimizedAIService.js';
import cacheService from './services/cacheService.js';
import resilienceService from './services/resilienceService.js';
import notificationService from './services/notificationService.js';
import escalationService from './services/escalationService.js';
import monitoringService from './services/monitoringService.js';
import pdfReceiptService from './services/pdfReceiptService.js';
import healthApp from './health.js';
import { 
  generateCalendarKeyboard, 
  parseCalendarCallback, 
  formatDateForDisplay,
  getNextMonth,
  getPreviousMonth,
  isValidFutureDate 
} from './utils/calendarUtils.js';

// Validate required environment variables
if (!process.env.TELEGRAM_BOT_TOKEN) {
  await logEvent('error', 'Missing required environment variable: TELEGRAM_BOT_TOKEN', { 
    context: 'bot_initialization',
    missing_variable: 'TELEGRAM_BOT_TOKEN'
  });
  process.exit(1);
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Helper function to get localized messages from database
async function getMessage(key, language = 'en', userId = null) {
  try {
    const message = await databaseService.getKnowledgeBase(key, language);
    
    if (userId) {
      await logEvent('info', 'Message retrieved from database', {
        user_id: userId,
        message_key: key,
        language,
        context: 'knowledge_base_lookup'
      });
    }
    
    return message;
  } catch (error) {
    await logEvent('error', 'Failed to retrieve message from database', {
      user_id: userId,
      message_key: key,
      language,
      error: error.message,
      context: 'knowledge_base_lookup'
    });
    
    // Fallback message
    return `Message not available: ${key}`;
  }
}

// Helper functions for dynamic data retrieval from database

// Get cities with localized names
async function getCities(language = 'en', userId = null) {
  try {
    const cities = await databaseService.getCities(language);
    
    if (userId) {
      await logEvent('info', 'Cities retrieved from database', {
        user_id: userId,
        language,
        count: cities.length,
        context: 'city_lookup'
      });
    }
    
    return cities;
  } catch (error) {
    await logEvent('error', 'Failed to retrieve cities from database', {
      user_id: userId,
      language,
      error: error.message,
      context: 'city_lookup'
    });
    
    return [];
  }
}

// Get hotels for a specific city
async function getHotels(cityKey, language = 'en', userId = null) {
  try {
    const hotels = await databaseService.getHotels(cityKey, language);
    
    if (userId) {
      await logEvent('info', 'Hotels retrieved from database', {
        user_id: userId,
        city_key: cityKey,
        language,
        count: hotels.length,
        context: 'hotel_lookup'
      });
    }
    
    return hotels;
  } catch (error) {
    await logEvent('error', 'Failed to retrieve hotels from database', {
      user_id: userId,
      city_key: cityKey,
      language,
      error: error.message,
      context: 'hotel_lookup'
    });
    
    return [];
  }
}

// Get specific hotel by ID
async function getHotel(hotelId, language = 'en', userId = null) {
  try {
    const hotel = await databaseService.getHotel(hotelId, language);
    
    if (userId) {
      await logEvent('info', 'Hotel retrieved from database', {
        user_id: userId,
        hotel_id: hotelId,
        language,
        context: 'hotel_detail_lookup'
      });
    }
    
    return hotel;
  } catch (error) {
    await logEvent('error', 'Failed to retrieve hotel from database', {
      user_id: userId,
      hotel_id: hotelId,
      language,
      error: error.message,
      context: 'hotel_detail_lookup'
    });
    
    return null;
  }
}

// Get payment methods with localized names
async function getPaymentMethods(language = 'en', userId = null) {
  try {
    const paymentMethods = await databaseService.getPaymentMethods(language);
    
    if (userId) {
      await logEvent('info', 'Payment methods retrieved from database', {
        user_id: userId,
        language,
        count: paymentMethods.length,
        context: 'payment_methods_lookup'
      });
    }
    
    return paymentMethods;
  } catch (error) {
    await logEvent('error', 'Failed to retrieve payment methods from database', {
      user_id: userId,
      language,
      error: error.message,
      context: 'payment_methods_lookup'
    });
    
    return [];
  }
}

// User sessions with memory optimization
const userSessions = new Map();
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const MAX_SESSIONS = 1000; // Maximum number of sessions to keep in memory

// Session cleanup function to prevent memory leaks
function cleanupOldSessions() {
  const now = Date.now();
  const sessionsToDelete = [];
  
  for (const [userId, session] of userSessions.entries()) {
    // Add lastActivity timestamp if not present
    if (!session.lastActivity) {
      session.lastActivity = now;
    }
    
    // Remove sessions older than 24 hours
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessionsToDelete.push(userId);
    }
  }
  
  // Delete old sessions
  sessionsToDelete.forEach(userId => userSessions.delete(userId));
  
  // If still too many sessions, remove oldest ones
  if (userSessions.size > MAX_SESSIONS) {
    const sessions = Array.from(userSessions.entries());
    sessions.sort((a, b) => (a[1].lastActivity || 0) - (b[1].lastActivity || 0));
    
    const toRemove = userSessions.size - MAX_SESSIONS;
    for (let i = 0; i < toRemove; i++) {
      userSessions.delete(sessions[i][0]);
    }
  }
  
  // Force garbage collection if available
  if (global.gc && userSessions.size > MAX_SESSIONS * 0.8) {
    global.gc();
  }
}

// Run session cleanup every 30 minutes
setInterval(cleanupOldSessions, 30 * 60 * 1000);

// Bot states
const STATES = {
  LANGUAGE_SELECTION: 'language_selection',
  MAIN_MENU: 'main_menu',
  CITY_SELECTION: 'city_selection',
  HOTEL_SELECTION: 'hotel_selection',
  CHECK_IN_DATE: 'check_in_date',
  CHECK_OUT_DATE: 'check_out_date',
  GUEST_COUNT: 'guest_count',
  PAYMENT_METHOD: 'payment_method',
  EMAIL_COLLECTION: 'email_collection',
  CONFIRMATION: 'confirmation',
  AI_CHAT: 'ai_chat',
  ESCALATION: 'escalation',
  IDLE: 'idle',
  BOOKING: 'booking',
  WAITING_CONFIRMATION: 'waiting_confirmation',
  WAITING_PAYMENT: 'waiting_payment',
  WAITING_DETAILS: 'waiting_details',
  WAITING_PHONE: 'waiting_phone',
  WAITING_EMAIL: 'waiting_email',
  WAITING_SPECIAL_REQUESTS: 'waiting_special_requests',
  WAITING_FINAL_CONFIRMATION: 'waiting_final_confirmation'
};

// Get user session with activity tracking
function getUserSession(userId) {
  const now = Date.now();
  
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      language: 'en',
      languageExplicitlySet: false,
      state: STATES.LANGUAGE_SELECTION,
      destination: null,
      selectedHotel: null,
      checkInDate: null,
      checkOutDate: null,
      guests: null,
      paymentMethod: null,
      lastActivity: now,
      createdAt: now
    });
  } else {
    // Update last activity timestamp
    const session = userSessions.get(userId);
    session.lastActivity = now;
  }
  
  return userSessions.get(userId);
}

// Get text in user's language (now using database)
async function getText(key, language = 'en', userId = null) {
  try {
    const message = await getMessage(key, language, userId);
    return message || key;
  } catch (error) {
    await logEvent('error', 'Failed to get text from database', {
      user_id: userId,
      key,
      language,
      error: error.message,
      context: 'text_lookup'
    });
    return key;
  }
}

// Create main menu keyboard
async function createMainMenuKeyboard(language, userId = null) {
  return {
    inline_keyboard: [
      [{ text: await getText('searchHotels', language, userId), callback_data: 'search_hotels' }],
      [{ text: await getText('myBookings', language, userId), callback_data: 'my_bookings' }],
      [{ text: await getText('support', language, userId), callback_data: 'support' }],
      [{ text: await getText('about', language, userId), callback_data: 'about' }]
    ]
  };
}

// Create back to menu keyboard
async function createBackToMenuKeyboard(language, userId = null) {
  return {
    inline_keyboard: [
      [{ text: await getText('backToMenu', language, userId), callback_data: 'back_to_menu' }]
    ]
  };
}

// Search knowledge base (now using database)
async function searchKnowledgeBase(query, language, userId = null) {
  try {
    // For now, we'll search through common knowledge base keys
    const commonKeys = [
      'greeting', 'searchHotels', 'myBookings', 'support', 'about',
      'selectLanguage', 'selectDestination', 'selectHotel', 'selectDates',
      'selectGuests', 'confirmBooking', 'paymentMethod', 'bookingConfirmed',
      'bookingFailed', 'noHotelsFound', 'invalidDate', 'supportMessage',
      'aboutMessage', 'backToMenu', 'cancel', 'help', 'error'
    ];
    
    const queryLower = query.toLowerCase();
    
    for (const key of commonKeys) {
      const content = await getMessage(key, language, userId);
      if (content && (
          key.toLowerCase().includes(queryLower) || 
          content.toLowerCase().includes(queryLower)
        )) {
        return content;
      }
    }
    
    return null;
  } catch (error) {
    await logEvent('error', 'Failed to search knowledge base', {
      user_id: userId,
      query: query.substring(0, 100),
      language,
      error: error.message,
      context: 'knowledge_base_search'
    });
    return null;
  }
}

// AI chat handler - now using optimized AI service with resilience and escalation
async function handleAIChat(query, language, userId, username = null, conversationHistory = []) {
  try {
    // Get user session to track failures
    const session = getUserSession(userId);
    const failureCount = session.aiFailureCount || 0;
    
    // Check if escalation is needed before processing
    const escalationCheck = await escalationService.shouldEscalate({
      userId,
      username,
      query,
      failureCount,
      conversationHistory,
      lastResponse: session.lastAIResponse
    });
    
    if (escalationCheck.shouldEscalate) {
      // Create escalation record
      const escalation = await escalationService.createEscalation({
        userId,
        username,
        query,
        reason: escalationCheck.reason,
        priority: escalationCheck.priority,
        details: escalationCheck.details,
        conversationHistory,
        metadata: { language, failure_count: failureCount }
      });
      
      // Update session state
      session.state = STATES.ESCALATION;
      session.escalationId = escalation.id;
      
      // Return escalation message
      return escalationService.generateEscalationMessage(escalation);
    }
    
    // Use resilience service to wrap the AI operation with graceful fallback
    const response = await resilienceService.executeAIOperation(
      async () => {
        const result = await optimizedAIService.processQuery(query, language, userId);
        
        if (result && result.response) {
          // Reset failure count on success
          session.aiFailureCount = 0;
          session.lastAIResponse = result.response;
          
          await logEvent('info', 'Optimized AI query successful', {
            context: 'ai_chat',
            user_id: userId,
            language: language,
            query: query.substring(0, 100),
            method: result.method,
            tokens_used: result.tokensUsed,
            cost_estimate: result.costEstimate,
            response_time: result.responseTime
          });
          
          return result.response;
        }
        
        throw new Error('No response from optimized AI service');
      },
      await resilienceService.getGracefulErrorMessage('error', language),
      'optimized_ai_service'
    );
    
    return response;
    
  } catch (error) {
    // Increment failure count
    const session = getUserSession(userId);
    session.aiFailureCount = (session.aiFailureCount || 0) + 1;
    
    await logEvent('error', 'AI chat error - using final fallback', {
      context: 'ai_chat',
      user_id: userId,
      language: language,
      query: query.substring(0, 100),
      error: error.message,
      failure_count: session.aiFailureCount
    });
    
    // Check if we should escalate due to consecutive failures
    if (session.aiFailureCount >= 3) {
      try {
        const escalation = await escalationService.createEscalation({
          userId,
          username,
          query,
          reason: 'consecutive_failures',
          priority: 'high',
          details: `${session.aiFailureCount} consecutive AI failures`,
          conversationHistory,
          metadata: { language, error: error.message }
        });
        
        session.state = STATES.ESCALATION;
        session.escalationId = escalation.id;
        
        return escalationService.generateEscalationMessage(escalation);
      } catch (escalationError) {
        await logEvent('error', 'Failed to create escalation after AI failures', {
          context: 'escalation',
          user_id: userId,
          error: escalationError.message
        });
      }
    }
    
    // Final fallback to knowledge base error message
    return await resilienceService.getGracefulErrorMessage('error', language);
  }
}

// Language detection and mapping
const languageMapping = {
  'eng': 'en',  // English
  'amh': 'am',  // Amharic
  'som': 'so',  // Somali
  'orm': 'or',  // Oromo
  'tir': 'ti'   // Tigrinya
};

function detectLanguage(text) {
  try {
    // Use franc to detect language
    const detectedLang = franc(text);
    
    // Map franc language codes to our language codes
    const mappedLang = languageMapping[detectedLang];
    
    // Return mapped language or default to English
    return mappedLang || 'en';
  } catch (error) {
    logEvent('error', 'Language detection error', {
      context: 'language_detection',
      text: text.substring(0, 50),
      error: error.message
    });
    return 'en'; // Default to English on error
  }
}

function autoSwitchLanguage(session, detectedLanguage) {
  // Only auto-switch if user hasn't explicitly selected a language
  if (!session.languageExplicitlySet && detectedLanguage !== session.language) {
    session.language = detectedLanguage;
    logEvent('info', 'Auto-switched language', {
      context: 'language_auto_switch',
      new_language: detectedLanguage,
      previous_language: session.language
    });
    return true;
  }
  return false;
}

// Start command
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const session = getUserSession(userId);
    session.state = STATES.LANGUAGE_SELECTION;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '🇺🇸 English', callback_data: 'lang_en' },
          { text: '🇪🇹 አማርኛ', callback_data: 'lang_am' }
        ],
        [
          { text: '🇸🇴 Soomaali', callback_data: 'lang_so' },
          { text: '🇪🇹 Oromoo', callback_data: 'lang_or' }
        ],
        [
          { text: '🇪🇹 ትግርኛ', callback_data: 'lang_ti' },
          { text: '🇪🇹 Afar', callback_data: 'lang_aa' }
        ]
      ]
    };
    
    await ctx.reply(await getText('selectLanguage', 'en', userId), { reply_markup: keyboard });
    
    await logEvent('info', 'Bot start command executed', {
      context: 'bot_start',
      user_id: userId,
      username: ctx.from.username,
      first_name: ctx.from.first_name
    });
  } catch (error) {
    await logEvent('error', 'Start command error', {
      context: 'bot_start',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', 'en', ctx.from.id));
  }
});

// Show main menu
async function showMainMenu(ctx, session) {
  try {
    const greeting = await getText('greeting', session.language, ctx.from.id);
    const mainMenu = await getText('mainMenu', session.language, ctx.from.id);
    const keyboard = await createMainMenuKeyboard(session.language, ctx.from.id);
    
    await ctx.reply(`${greeting}\n\n${mainMenu}`, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
    session.state = STATES.MAIN_MENU;

    await logEvent('info', 'Main menu displayed successfully', {
      context: 'main_menu',
      user_id: ctx.from.id,
      language: session.language
    });

  } catch (error) {
    await logEvent('error', 'Failed to show main menu', {
      context: 'main_menu',
      user_id: ctx.from.id,
      language: session.language,
      error: error.message
    });

    // Fallback to basic menu
    try {
      await ctx.reply(await resilienceService.getGracefulErrorMessage('error', session.language));
    } catch (fallbackError) {
      await ctx.reply("Sorry, I'm experiencing technical difficulties. Please try again later.");
    }
  }
}

// Language selection handlers
bot.action(/^lang_(.+)$/, async (ctx) => {
  try {
    const language = ctx.match[1];
    const session = getUserSession(ctx.from.id);
    session.language = language;
    session.languageExplicitlySet = true;
    
    await logEvent('info', 'Language selected', {
      context: 'language_selection',
      user_id: ctx.from.id,
      selected_language: language
    });
    
    await showMainMenu(ctx, session);
  } catch (error) {
    await logEvent('error', 'Language selection error', {
      context: 'language_selection',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// Hotel search handler
bot.action('search_hotels', async (ctx) => {
  try {
    const session = getUserSession(ctx.from.id);
    session.state = STATES.CITY_SELECTION;
    
    const cities = await getCities(session.language, ctx.from.id);
    
    // Create keyboard with cities from database
    const cityButtons = [];
    for (let i = 0; i < cities.length; i += 2) {
      const row = [];
      row.push({ text: cities[i].name, callback_data: `city_${cities[i].key}` });
      if (i + 1 < cities.length) {
        row.push({ text: cities[i + 1].name, callback_data: `city_${cities[i + 1].key}` });
      }
      cityButtons.push(row);
    }
    
    const keyboard = {
      inline_keyboard: [
        ...cityButtons,
        [{ text: await getText('backToMenu', session.language, ctx.from.id), callback_data: 'back_to_menu' }]
      ]
    };
    
    await ctx.editMessageText(await getText('destination', session.language, ctx.from.id), { reply_markup: keyboard });
    
    await logEvent('info', 'Hotel search initiated', {
      context: 'hotel_search',
      user_id: ctx.from.id,
      language: session.language
    });
  } catch (error) {
    await logEvent('error', 'Hotel search error', {
      context: 'hotel_search',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// Back to menu handler
bot.action('back_to_menu', async (ctx) => {
  try {
    const session = getUserSession(ctx.from.id);
    await ctx.editMessageText(await getText('mainMenu', session.language, ctx.from.id), { 
      reply_markup: await createMainMenuKeyboard(session.language, ctx.from.id),
      parse_mode: 'Markdown'
    });
    session.state = STATES.MAIN_MENU;
  } catch (error) {
    await logEvent('error', 'Back to menu error', {
      context: 'navigation',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// FAQ handlers
bot.action(/^faq_(.+)$/, async (ctx) => {
  try {
    const topic = ctx.match[1];
    const session = getUserSession(ctx.from.id);
    
    const answer = await getMessage(topic, session.language, ctx.from.id) || 
                   await getText('noAnswer', session.language, ctx.from.id);
    const keyboard = await createBackToMenuKeyboard(session.language, ctx.from.id);
    
    await ctx.editMessageText(answer, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
    
    await logEvent('info', 'FAQ accessed', {
      context: 'faq',
      user_id: ctx.from.id,
      topic: topic,
      language: session.language
    });
  } catch (error) {
    await logEvent('error', 'FAQ handler error', {
      context: 'faq',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// City selection
bot.action(/^city_(.+)$/, async (ctx) => {
  try {
    const cityKey = ctx.match[1];
    const session = getUserSession(ctx.from.id);
    session.destination = cityKey;
    session.state = STATES.HOTEL_SELECTION;
    
    const hotels = await getHotels(cityKey, session.language, ctx.from.id);
    const cities = await getCities(session.language, ctx.from.id);
    const city = cities.find(c => c.key === cityKey);
    const cityName = city ? city.name : cityKey;
    
    let hotelsList = `${await getText('hotels', session.language, ctx.from.id)} ${cityName}:\n\n`;
    hotels.forEach(hotel => {
      const stars = '⭐'.repeat(hotel.rating);
      hotelsList += `🏨 *${hotel.name}*\n${stars} | ${hotel.price_per_night} ETB/night\n${hotel.description}\n\n`;
    });
    
    const keyboard = {
      inline_keyboard: [
        ...hotels.map(hotel => [
          { text: `${hotel.name} - ${hotel.price_per_night} ETB`, callback_data: `hotel_${hotel.id}` }
        ]),
        [{ text: await getText('backToMenu', session.language, ctx.from.id), callback_data: 'back_to_menu' }]
      ]
    };
    
    await ctx.editMessageText(hotelsList, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
    
    await logEvent('info', 'City selected for hotel search', {
      context: 'city_selection',
      user_id: ctx.from.id,
      city: cityKey,
      language: session.language
    });
  } catch (error) {
    await logEvent('error', 'City selection error', {
      context: 'city_selection',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// Hotel selection
bot.action(/^hotel_(.+)$/, async (ctx) => {
  try {
    const hotelId = ctx.match[1];
    const session = getUserSession(ctx.from.id);
    
    // Find the hotel using database
    const selectedHotel = await getHotel(hotelId, session.language, ctx.from.id);
    
    if (!selectedHotel) {
      await ctx.reply(await getText('error', session.language, ctx.from.id));
      return;
    }
    
    session.selectedHotel = selectedHotel;
    session.state = STATES.CHECK_IN_DATE;
    
    // Show calendar picker for check-in date
    const today = new Date();
    const calendar = generateCalendarKeyboard(today.getFullYear(), today.getMonth(), 'checkin', null, session.language);
    const checkInMsg = await getText('checkIn', session.language, ctx.from.id) || 
                      "📅 Please select your check-in date:";
    await ctx.editMessageText(checkInMsg, { reply_markup: calendar });
    
    await logEvent('info', 'Hotel selected', {
      context: 'hotel_selection',
      user_id: ctx.from.id,
      hotel_id: hotelId,
      hotel_name: selectedHotel.name,
      language: session.language
    });
  } catch (error) {
    await logEvent('error', 'Hotel selection error', {
      context: 'hotel_selection',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// Text message handler for dates and guest count
bot.on('text', async (ctx) => {
  try {
    const session = getUserSession(ctx.from.id);
    const text = ctx.message.text;
    
    // Auto-detect language if not explicitly set
    if (!session.languageExplicitlySet) {
      const detectedLang = detectLanguage(text);
      autoSwitchLanguage(session, detectedLang);
    }
    
    // Note: Date selection now handled by calendar picker
    // Keep guest count as fallback for text input
    if (session.state === STATES.GUEST_COUNT) {
      try {
        const guests = parseInt(text);
        if (isNaN(guests) || guests < 1 || guests > 10) {
          const invalidGuestsMsg = await getText('invalidGuests', session.language, ctx.from.id) ||
                                  await resilienceService.getGracefulErrorMessage('error', session.language);
          await ctx.reply(invalidGuestsMsg);
          return;
        }
        
        session.guests = guests;
        session.state = STATES.PAYMENT_METHOD;
        
        // Show payment methods from database
        try {
          const paymentMethods = await getPaymentMethods(session.language, ctx.from.id);
          
          // Create keyboard with payment methods from database
          const paymentButtons = [];
          for (let i = 0; i < paymentMethods.length; i += 2) {
            const row = [];
            row.push({ text: paymentMethods[i].name, callback_data: `payment_${paymentMethods[i].key}` });
            if (i + 1 < paymentMethods.length) {
              row.push({ text: paymentMethods[i + 1].name, callback_data: `payment_${paymentMethods[i + 1].key}` });
            }
            paymentButtons.push(row);
          }
          
          const backToMenuText = await getText('backToMenu', session.language, ctx.from.id) || "Back to Menu";
          const keyboard = {
            inline_keyboard: [
              ...paymentButtons,
              [{ text: backToMenuText, callback_data: 'back_to_menu' }]
            ]
          };
          
          const paymentMsg = await getText('payment', session.language, ctx.from.id) ||
                            "Please select a payment method:";
          await ctx.reply(paymentMsg, { reply_markup: keyboard });
          
          await logEvent('info', 'Guest count entered and payment methods displayed', {
            context: 'booking_flow',
            user_id: ctx.from.id,
            guest_count: guests,
            language: session.language,
            payment_methods_count: paymentMethods.length
          });
          
        } catch (paymentError) {
          await logEvent('error', 'Payment methods retrieval failed', {
            context: 'booking_flow_error',
            user_id: ctx.from.id,
            error: paymentError.message,
            guest_count: guests
          });
          
          const errorMsg = await resilienceService.getGracefulErrorMessage('error', session.language);
          await ctx.reply(errorMsg);
        }
        
      } catch (guestError) {
        await logEvent('error', 'Guest count processing failed', {
          context: 'booking_flow_error',
          user_id: ctx.from.id,
          error: guestError.message,
          input_text: text
        });
        
        const errorMsg = await resilienceService.getGracefulErrorMessage('error', session.language);
        await ctx.reply(errorMsg);
      }
      
    } else if (session.state === STATES.EMAIL_COLLECTION) {
      // Handle email collection
      const email = text.trim();
      
      // Simple email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        const invalidEmailMsg = session.language === 'am' ? 
          "❌ እባክዎ ትክክለኛ የኢሜል አድራሻ ያስገቡ (ምሳሌ: user@example.com)" :
          session.language === 'ti' ?
          "❌ በጃኹም ቅኑዕ ናይ ኢሜል አድራሻ ኣእትዉ (ኣብነት: user@example.com)" :
          "❌ Please enter a valid email address (example: user@example.com)";
        
        await ctx.reply(invalidEmailMsg);
        return;
      }
      
      // Save email and proceed to confirmation
      session.email = email;
      session.state = STATES.CONFIRMATION;
      
      // Show booking summary
      const hotel = session.selectedHotel;
      const cities = await getCities(session.language, ctx.from.id);
      const city = cities.find(c => c.key === session.destination);
      const cityName = city ? city.name : session.destination;
      
      const paymentMethods = await getPaymentMethods(session.language, ctx.from.id);
      const selectedPayment = paymentMethods.find(pm => pm.key === session.paymentMethod);
      const paymentName = selectedPayment ? selectedPayment.name : session.paymentMethod;
      
      const summary = `${await getText('confirmation', session.language, ctx.from.id)}\n\n` +
        `🏨 *Hotel:* ${hotel.name}\n` +
        `📍 *City:* ${cityName}\n` +
        `📅 *Check-in:* ${session.checkInDate}\n` +
        `📅 *Check-out:* ${session.checkOutDate}\n` +
        `👥 *Guests:* ${session.guests}\n` +
        `💳 *Payment:* ${paymentName}\n` +
        `📧 *Email:* ${email}\n` +
        `💰 *Price:* ${hotel.price_per_night} ETB/night`;
      
      const keyboard = {
        inline_keyboard: [
          [{ text: await getText('confirmBooking', session.language, ctx.from.id), callback_data: 'confirm_booking' }],
          [{ text: await getText('backToMenu', session.language, ctx.from.id), callback_data: 'back_to_menu' }]
        ]
      };
      
      await ctx.reply(summary, { 
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });
      
      await logEvent('info', 'Email collected and booking summary shown', {
        context: 'booking_flow',
        user_id: ctx.from.id,
        email: email,
        language: session.language
      });
      
    } else {
      // Handle as AI chat with enhanced error handling
      try {
        session.state = STATES.AI_CHAT;
        
        // Get conversation history from session
        const conversationHistory = session.conversationHistory || [];
        conversationHistory.push({ role: 'user', content: text, timestamp: new Date() });
        
        // Keep only last 10 messages for context
        if (conversationHistory.length > 10) {
          conversationHistory.splice(0, conversationHistory.length - 10);
        }
        
        session.conversationHistory = conversationHistory;
        session.lastUserMessage = text;
        
        const response = await handleAIChat(
          text, 
          session.language, 
          ctx.from.id, 
          ctx.from.username || ctx.from.first_name, 
          conversationHistory
        );
        
        if (response) {
          try {
            const keyboard = {
              inline_keyboard: [
                [
                  { text: '👍 Helpful', callback_data: `feedback_helpful_${ctx.message.message_id}` },
                  { text: '👎 Not Helpful', callback_data: `feedback_not_helpful_${ctx.message.message_id}` }
                ],
                [
                  { text: '🆘 Escalate to Human', callback_data: `escalate_${ctx.message.message_id}` }
                ],
                [{ text: await getText('backToMenu', session.language, ctx.from.id), callback_data: 'back_to_menu' }]
              ]
            };
            
            await ctx.reply(response, { reply_markup: keyboard });
            
            await logEvent('info', 'AI chat response sent successfully', {
              context: 'ai_chat_response',
              user_id: ctx.from.id,
              language: session.language,
              response_length: response.length
            });
            
          } catch (keyboardError) {
            // Fallback without keyboard if keyboard creation fails
            await logEvent('warn', 'Keyboard creation failed, sending response without keyboard', {
              context: 'ai_chat_keyboard',
              user_id: ctx.from.id,
              error: keyboardError.message
            });
            
            await ctx.reply(response);
          }
        } else {
          // No response from AI - use fallback
          const keyboard = await createBackToMenuKeyboard(session.language, ctx.from.id);
          const noAnswerText = await getText('noAnswer', session.language, ctx.from.id) || 
                              await resilienceService.getGracefulErrorMessage('error', session.language);
          await ctx.reply(noAnswerText, { reply_markup: keyboard });
        }
        
      } catch (aiChatError) {
        await logEvent('error', 'AI chat handling failed', {
          context: 'ai_chat_error',
          user_id: ctx.from.id,
          language: session.language,
          error: aiChatError.message
        });
        
        // Fallback to knowledge base error message
        const errorMessage = await resilienceService.getGracefulErrorMessage('error', session.language);
        const keyboard = await createBackToMenuKeyboard(session.language, ctx.from.id);
        await ctx.reply(errorMessage, { reply_markup: keyboard });
      }
    }
  } catch (error) {
    await logEvent('error', 'Text message handler error', {
      context: 'text_handler',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// Payment method selection
bot.action(/^payment_(.+)$/, async (ctx) => {
  try {
    const paymentMethod = ctx.match[1];
    const session = getUserSession(ctx.from.id);
    session.paymentMethod = paymentMethod;
    session.state = STATES.EMAIL_COLLECTION;
    
    // Ask for email address
    const emailMsg = session.language === 'am' ? 
      "📧 እባክዎ የኢሜል አድራሻዎን ያስገቡ (ለማረጋገጫ እና ደረሰኝ):" :
      session.language === 'ti' ?
      "📧 በጃኹም ናይ ኢሜል አድራሻኹም ኣእትዉ (ንምርግጋጽን ደረሰኝን):" :
      "📧 Please enter your email address (for confirmation and receipt):";
    
    const keyboard = {
      inline_keyboard: [
        [{ text: await getText('backToMenu', session.language, ctx.from.id), callback_data: 'back_to_menu' }]
      ]
    };
    
    await ctx.editMessageText(emailMsg, { reply_markup: keyboard });
    
    await logEvent('info', 'Payment method selected, requesting email', {
      context: 'booking_flow',
      user_id: ctx.from.id,
      payment_method: paymentMethod,
      language: session.language
    });
  } catch (error) {
    await logEvent('error', 'Payment method selection error', {
      context: 'payment_selection',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// Calendar navigation and date selection handlers
bot.action(/^cal_(.+)$/, async (ctx) => {
  try {
    const session = getUserSession(ctx.from.id);
    const callbackData = ctx.match[0];
    const parsed = parseCalendarCallback(callbackData);
    
    if (!parsed) {
      return; // Invalid callback data
    }
    
    const { action, type, year, month, day } = parsed;
    
    if (action === 'ignore') {
      // Do nothing for ignored buttons
      await ctx.answerCbQuery();
      return;
    }
    
    if (action === 'prev') {
      // Show previous month
      const { year: prevYear, month: prevMonth } = getPreviousMonth(year, month);
      const selectedCheckIn = type === 'checkout' ? new Date(session.checkInDate.split('/').reverse().join('-')) : null;
      const calendar = generateCalendarKeyboard(prevYear, prevMonth, type, selectedCheckIn, session.language);
      
      const messageText = type === 'checkin' ? 
        (await getText('checkIn', session.language, ctx.from.id) || "📅 Please select your check-in date:") :
        (await getText('checkOut', session.language, ctx.from.id) || "📅 Please select your check-out date:");
      
      await ctx.editMessageText(messageText, { reply_markup: calendar });
      await ctx.answerCbQuery();
      
    } else if (action === 'next') {
      // Show next month
      const { year: nextYear, month: nextMonth } = getNextMonth(year, month);
      const selectedCheckIn = type === 'checkout' ? new Date(session.checkInDate.split('/').reverse().join('-')) : null;
      const calendar = generateCalendarKeyboard(nextYear, nextMonth, type, selectedCheckIn, session.language);
      
      const messageText = type === 'checkin' ? 
        (await getText('checkIn', session.language, ctx.from.id) || "📅 Please select your check-in date:") :
        (await getText('checkOut', session.language, ctx.from.id) || "📅 Please select your check-out date:");
      
      await ctx.editMessageText(messageText, { reply_markup: calendar });
      await ctx.answerCbQuery();
      
    } else if (action === 'select') {
      // Date selected
      const selectedDate = new Date(year, month, day);
      const formattedDate = formatDateForDisplay(selectedDate, session.language);
      
      if (type === 'checkin') {
        session.checkInDate = formattedDate;
        session.state = STATES.CHECK_OUT_DATE;
        
        // Show calendar for check-out date
        const calendar = generateCalendarKeyboard(year, month, 'checkout', selectedDate, session.language);
        const checkOutMsg = await getText('checkOut', session.language, ctx.from.id) || 
                           "📅 Please select your check-out date:";
        await ctx.editMessageText(checkOutMsg, { reply_markup: calendar });
        
        await logEvent('info', 'Check-in date selected via calendar', {
          context: 'booking_flow',
          user_id: ctx.from.id,
          check_in_date: formattedDate,
          language: session.language
        });
        
      } else if (type === 'checkout') {
        session.checkOutDate = formattedDate;
        session.state = STATES.GUEST_COUNT;
        
        // Show guest count selection
        const guestKeyboard = {
          inline_keyboard: [
            [
              { text: '1', callback_data: 'guests_1' },
              { text: '2', callback_data: 'guests_2' },
              { text: '3', callback_data: 'guests_3' },
              { text: '4', callback_data: 'guests_4' }
            ],
            [
              { text: '5', callback_data: 'guests_5' },
              { text: '6', callback_data: 'guests_6' },
              { text: '7', callback_data: 'guests_7' },
              { text: '8', callback_data: 'guests_8' }
            ],
            [
              { text: '9', callback_data: 'guests_9' },
              { text: '10', callback_data: 'guests_10' }
            ],
            [
              { text: await getText('backToMenu', session.language, ctx.from.id) || '🔙 Back to Menu', callback_data: 'back_to_menu' }
            ]
          ]
        };
        
        const guestsMsg = await getText('guests', session.language, ctx.from.id) || 
                         "👥 Please select the number of guests:";
        await ctx.editMessageText(guestsMsg, { reply_markup: guestKeyboard });
        
        await logEvent('info', 'Check-out date selected via calendar', {
          context: 'booking_flow',
          user_id: ctx.from.id,
          check_out_date: formattedDate,
          language: session.language
        });
      }
      
      await ctx.answerCbQuery();
    }
    
  } catch (error) {
    await logEvent('error', 'Calendar handler error', {
      context: 'calendar_selection',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.answerCbQuery('Error occurred');
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// Guest count selection handler
bot.action(/^guests_(\d+)$/, async (ctx) => {
  try {
    const guests = parseInt(ctx.match[1]);
    const session = getUserSession(ctx.from.id);
    
    session.guests = guests;
    session.state = STATES.PAYMENT_METHOD;
    
    // Show payment methods
    const paymentMethods = await getPaymentMethods(session.language, ctx.from.id);
    const keyboard = {
      inline_keyboard: [
        ...paymentMethods.map(method => [{ 
          text: method.name, 
          callback_data: `payment_${method.key}` 
        }]),
        [{ text: await getText('backToMenu', session.language, ctx.from.id), callback_data: 'back_to_menu' }]
      ]
    };
    
    const paymentMsg = await getText('payment', session.language, ctx.from.id) || 
                      "💳 Please select your payment method:";
    await ctx.editMessageText(paymentMsg, { reply_markup: keyboard });
    
    await logEvent('info', 'Guest count selected', {
      context: 'booking_flow',
      user_id: ctx.from.id,
      guests: guests,
      language: session.language
    });
    
  } catch (error) {
    await logEvent('error', 'Guest count selection error', {
      context: 'guest_selection',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// Booking confirmation
bot.action('confirm_booking', async (ctx) => {
  try {
    const session = getUserSession(ctx.from.id);
    
    // Save booking to database if Supabase is available
    if (supabase) {
      try {
        const bookingData = {
          user_id: ctx.from.id,
          username: ctx.from.username || null,
          first_name: ctx.from.first_name || null,
          last_name: ctx.from.last_name || null,
          hotel_id: session.selectedHotel.id,
          hotel_name: session.selectedHotel.name,
          city: session.destination,
          check_in_date: session.checkInDate,
          check_out_date: session.checkOutDate,
          guests: session.guests,
          payment_method: session.paymentMethod,
          total_price: session.selectedHotel.price_per_night,
          language: session.language,
          booking_status: 'confirmed',
          created_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase.from('bookings').insert(bookingData).select();
        
        if (error) {
          await logEvent('error', 'Booking database save error', {
            context: 'booking_confirmation',
            user_id: ctx.from.id,
            error: error.message
          });
        } else {
          const booking = data[0];
          await logEvent('info', 'Booking saved to database', {
            context: 'booking_confirmation',
            user_id: ctx.from.id,
            booking_id: booking?.id,
            hotel_name: session.selectedHotel.name
          });
          
          // Send notifications and generate PDF receipt
          try {
            // Send email confirmation if user has email
            if (session.email) {
              await notificationService.sendBookingConfirmation(booking, session.email);
            }
            
            // Generate PDF receipt
            const receiptData = {
              ...booking,
              guest_name: ctx.from.first_name || ctx.from.username || 'Guest',
              guest_email: session.email,
              email: session.email,
              check_in: session.checkInDate,
              check_out: session.checkOutDate,
              check_in_date: session.checkInDate,
              check_out_date: session.checkOutDate
            };
            
            const pdfPath = await pdfReceiptService.generateBookingReceipt(receiptData, session.language);
            
            // Send PDF receipt to user
            const receiptMsg = session.language === 'am' ? 
              "📄 የቦታ ምሕዛዝ ደረሰኝዎ:" :
              session.language === 'ti' ?
              "📄 ናይ ቦታ ምሕዛዝ ደረሰኝኹም:" :
              "📄 Your booking receipt:";
            
            await ctx.replyWithDocument({ source: pdfPath, filename: `booking_receipt_${booking.id}.pdf` }, {
              caption: receiptMsg
            });
            
            // Send Telegram notification to admin group
            await notificationService.sendAdminNotification('new_booking', {
              bookingId: booking.id,
              hotelName: session.selectedHotel.name,
              userName: ctx.from.first_name || ctx.from.username,
              checkIn: session.checkInDate,
              checkOut: session.checkOutDate,
              guests: session.guests,
              totalPrice: session.selectedHotel.price
            });
            
            // Clean up PDF file after sending (optional)
            setTimeout(() => {
              try {
                const fs = require('fs');
                if (fs.existsSync(pdfPath)) {
                  fs.unlinkSync(pdfPath);
                }
              } catch (cleanupError) {
                // Ignore cleanup errors
              }
            }, 60000); // Delete after 1 minute
            
          } catch (notificationError) {
            await logEvent('error', 'Booking notification/PDF error', {
              context: 'booking_confirmation',
              user_id: ctx.from.id,
              booking_id: booking?.id,
              error: notificationError.message
            });
          }
        }
      } catch (dbError) {
        await logEvent('error', 'Booking database error', {
          context: 'booking_confirmation',
          user_id: ctx.from.id,
          error: dbError.message
        });
      }
    }
    
    // Reset session
    session.state = STATES.MAIN_MENU;
    session.destination = null;
    session.selectedHotel = null;
    session.checkInDate = null;
    session.checkOutDate = null;
    session.guests = null;
    session.paymentMethod = null;
    
    const keyboard = {
      inline_keyboard: [
        [{ text: await getText('backToStart', session.language, ctx.from.id), callback_data: 'search_hotels' }],
        [{ text: await getText('backToMenu', session.language, ctx.from.id), callback_data: 'back_to_menu' }]
      ]
    };
    
    await ctx.editMessageText(await getText('thankYou', session.language, ctx.from.id), { reply_markup: keyboard });
    
    await logEvent('info', 'Booking confirmed successfully', {
      context: 'booking_confirmation',
      user_id: ctx.from.id,
      hotel_name: session.selectedHotel?.name,
      language: session.language
    });
  } catch (error) {
    await logEvent('error', 'Booking confirmation error', {
      context: 'booking_confirmation',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// Feedback handlers
bot.action(/^feedback_(helpful|not_helpful)_(\d+)$/, async (ctx) => {
  try {
    const feedbackType = ctx.match[1];
    const messageId = ctx.match[2];
    const session = getUserSession(ctx.from.id);
    
    // Save feedback to database if available
    if (supabase) {
      try {
        await supabase.from('ai_feedback').insert({
          user_id: ctx.from.id,
          username: ctx.from.username || null,
          feedback_type: feedbackType,
          message_id: parseInt(messageId),
          session_language: session.language,
          timestamp: new Date().toISOString()
        });
      } catch (dbError) {
        await logEvent('error', 'Feedback storage error', {
          context: 'feedback',
          user_id: ctx.from.id,
          error: dbError.message
        });
      }
    }
    
    // Thank user and provide options
    await ctx.editMessageText(await getText('feedbackThanks', session.language, ctx.from.id));
    const keyboard = await createBackToMenuKeyboard(session.language, ctx.from.id);
    await ctx.reply(await getText('mainMenu', session.language, ctx.from.id), { reply_markup: keyboard });
    
    await logEvent('info', 'Feedback received', {
      context: 'feedback',
      user_id: ctx.from.id,
      feedback_type: feedbackType,
      message_id: messageId,
      language: session.language
    });
  } catch (error) {
    await logEvent('error', 'Feedback handler error', {
      context: 'feedback',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// Escalation handlers
bot.action(/^escalate_(\d+)$/, async (ctx) => {
  try {
    const messageId = ctx.match[1];
    const session = getUserSession(ctx.from.id);
    session.state = STATES.ESCALATION;
    
    // Create escalation using escalation service
    try {
      const escalation = await escalationService.createEscalation({
        userId: ctx.from.id,
        username: ctx.from.username || ctx.from.first_name,
        query: session.lastUserMessage || 'Manual escalation request',
        reason: 'manual_request',
        priority: 'medium',
        details: 'User manually requested human agent assistance',
        conversationHistory: session.conversationHistory || [],
        metadata: { 
          language: session.language,
          message_id: parseInt(messageId),
          escalation_type: 'manual'
        }
      });
      
      session.escalationId = escalation.id;
      
      // Send admin notification
      await notificationService.sendAdminNotification('ai_escalation', {
        escalationId: escalation.id,
        userName: ctx.from.first_name || ctx.from.username,
        userId: ctx.from.id,
        reason: escalation.reason,
        priority: escalation.priority,
        query: escalation.query
      });
      
      await logEvent('info', 'Escalation created successfully', {
        context: 'escalation',
        user_id: ctx.from.id,
        escalation_id: escalation.id,
        reason: escalation.reason,
        priority: escalation.priority
      });
      
    } catch (escalationError) {
      await logEvent('error', 'Escalation service error', {
        context: 'escalation',
        user_id: ctx.from.id,
        error: escalationError.message
      });
      
      // Fallback to basic escalation logging
      if (supabase) {
        try {
          await supabase.from('escalations').insert({
            user_id: ctx.from.id,
            username: ctx.from.username || null,
            first_name: ctx.from.first_name || null,
            last_name: ctx.from.last_name || null,
            language: session.language,
            message_id: parseInt(messageId),
            timestamp: new Date().toISOString(),
            status: 'pending'
          });
        } catch (dbError) {
          await logEvent('error', 'Escalation storage error', {
            context: 'escalation',
            user_id: ctx.from.id,
            error: dbError.message
          });
        }
      }
    }
    
    const keyboard = await createBackToMenuKeyboard(session.language, ctx.from.id);
    await ctx.editMessageText(await getText('escalationReceived', session.language, ctx.from.id), { reply_markup: keyboard });
    
    await logEvent('info', 'Escalation request received', {
      context: 'escalation',
      user_id: ctx.from.id,
      message_id: messageId,
      language: session.language
    });
  } catch (error) {
    await logEvent('error', 'Escalation handler error', {
      context: 'escalation',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// Support and About handlers
bot.action('support', async (ctx) => {
  try {
    const session = getUserSession(ctx.from.id);
    const supportText = `🆘 **Customer Support**\n\nWe're here to help! You can:\n\n• Ask me any questions about hotels or bookings\n• Use the escalation button to speak with a human agent\n• Contact us directly at support@eqabo.com\n\nHow can I assist you today?`;
    
    const keyboard = await createBackToMenuKeyboard(session.language, ctx.from.id);
    await ctx.editMessageText(supportText, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
    
    await logEvent('info', 'Support page accessed', {
      context: 'support',
      user_id: ctx.from.id,
      language: session.language
    });
  } catch (error) {
    await logEvent('error', 'Support handler error', {
      context: 'support',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

bot.action('about', async (ctx) => {
  try {
    const session = getUserSession(ctx.from.id);
    const aboutText = `ℹ️ **About eQabo.com**\n\n🏨 Ethiopia's premier hotel booking platform\n🌟 Trusted by thousands of travelers\n💳 Secure payment options\n📱 24/7 customer support\n\nWe make hotel booking in Ethiopia simple, fast, and reliable!`;
    
    const keyboard = await createBackToMenuKeyboard(session.language, ctx.from.id);
    await ctx.editMessageText(aboutText, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
    
    await logEvent('info', 'About page accessed', {
      context: 'about',
      user_id: ctx.from.id,
      language: session.language
    });
  } catch (error) {
    await logEvent('error', 'About handler error', {
      context: 'about',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

bot.action('my_bookings', async (ctx) => {
  try {
    const session = getUserSession(ctx.from.id);
    const bookingsText = `📋 **My Bookings**\n\nTo view your bookings, please visit our website at eqabo.com or contact our support team.\n\nYour booking history and details are securely stored in your account.`;
    
    const keyboard = await createBackToMenuKeyboard(session.language, ctx.from.id);
    await ctx.editMessageText(bookingsText, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
    
    await logEvent('info', 'My bookings accessed', {
      context: 'my_bookings',
      user_id: ctx.from.id,
      language: session.language
    });
  } catch (error) {
    await logEvent('error', 'My bookings handler error', {
      context: 'my_bookings',
      user_id: ctx.from.id,
      error: error.message
    });
    await ctx.reply(await getText('error', session.language || 'en', ctx.from.id));
  }
});

// Error handling
bot.catch(async (err, ctx) => {
  await logEvent('error', 'Bot error caught', {
    context: 'bot_error',
    user_id: ctx?.from?.id,
    error: err.message,
    stack: err.stack
  });
  
  try {
    const session = getUserSession(ctx.from.id);
    await ctx.reply(await getText('error', session.language, ctx.from.id));
  } catch (replyError) {
    await logEvent('error', 'Error sending error message', {
      context: 'bot_error_reply',
      user_id: ctx?.from?.id,
      error: replyError.message
    });
  }
});

// Start the health server
const healthPort = process.env.HEALTH_PORT || 3000;
healthApp.listen(healthPort, () => {
  console.log(`✅ Health server running on port ${healthPort}`);
});

// Start the bot
await logEvent('info', 'Starting eQabo.com Telegram bot', {
  context: 'bot_startup',
  node_env: process.env.NODE_ENV,
  bot_token_present: !!process.env.TELEGRAM_BOT_TOKEN
});

bot.launch().then(async () => {
  await logEvent('info', 'eQabo.com bot started successfully', {
    context: 'bot_startup',
    status: 'success',
    health_port: healthPort
  });
  console.log('✅ eQabo.com bot started successfully');
  console.log(`✅ Health server running on port ${healthPort}`);
  
  // Initialize optimized AI services
  try {
    console.log('🔧 Initializing AI optimization services...');
    
    // Warm up cache with common queries
    await cacheService.warmUp();
    console.log('✅ Cache service warmed up');
    
    // Start monitoring service for critical errors
    await monitoringService.startMonitoring();
    console.log('✅ Monitoring service started');
    
    // Initialize notification service
    await notificationService.initialize();
    console.log('✅ Notification service initialized');
    
    // Initialize embeddings for existing data (if needed)
    // This will run in background and won't block bot startup
    setTimeout(async () => {
      try {
        console.log('🔄 Processing embeddings for existing data...');
        // Process knowledge base embeddings
        await optimizedAIService.processQuery('test initialization', 'en', 'system');
        console.log('✅ AI optimization services initialized');
      } catch (error) {
        console.warn('⚠️ AI optimization initialization warning:', error.message);
      }
    }, 5000); // Wait 5 seconds after bot start
    
  } catch (error) {
    console.warn('⚠️ AI optimization services initialization failed:', error.message);
    // Don't fail bot startup if optimization services fail
  }
}).catch(async (error) => {
  await logEvent('error', 'Failed to start bot', {
    context: 'bot_startup',
    error: error.message,
    stack: error.stack
  });
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT', async () => {
  await logEvent('info', 'Bot shutdown initiated', {
    context: 'bot_shutdown',
    signal: 'SIGINT'
  });
  bot.stop('SIGINT');
});

process.once('SIGTERM', async () => {
  await logEvent('info', 'Bot shutdown initiated', {
    context: 'bot_shutdown',
    signal: 'SIGTERM'
  });
  bot.stop('SIGTERM');
});

export default bot;