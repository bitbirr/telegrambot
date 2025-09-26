# eQabo.com Enhanced Telegram Bot 🏨🤖

A comprehensive Telegram bot for hotel booking in Ethiopia with **smart conversational flow**, **AI-powered assistance**, and **multi-language support**.

> **Latest Deployment:** Updated for Node.js 20.x compatibility - December 2024

## ✨ Enhanced Features

### 🔘 Smart Conversational Flow
- **Inline buttons everywhere** - Minimal typing required
- **Visual date selection** - Interactive calendar interface
- **Quick guest selection** - One-tap guest count selection
- **Seamless navigation** - Back-to-menu options throughout

### 🤖 AI-Powered Assistance
- **Knowledge Base First** - Instant FAQ responses
- **GPT-4o-mini Fallback** - Advanced AI for complex queries
- **Human Escalation** - Seamless handoff to support team
- **Multi-language AI** - Smart responses in user's language

### 🌍 Multi-Language Support
- **English** - International travelers
- **Amharic (አማርኛ)** - Primary Ethiopian language
- **Somali (Soomaali)** - Eastern Ethiopia
- **Oromo (Afaan Oromoo)** - Largest ethnic group
- **Tigrinya (ትግርኛ)** - Northern Ethiopia
- **Afar (Qafar af)** - Eastern Ethiopia

### 🏨 Enhanced Booking System
- **Smart Menu Navigation**
  - 🔍 Search Hotels
  - 📅 Book Room
  - 💳 Payment Options
  - ❓ FAQs
  - 🆘 Escalate to Human

### 💳 Local Payment Integration
- **Telebirr** - Ethiopia's leading mobile payment
- **Chappa** - Digital payment platform
- **eBirr** - Electronic payment system
- **CBE Birr** - Commercial Bank of Ethiopia

### 🛡️ Advanced Features
- **Session Management** - Persistent user state tracking
- **Date Validation** - Smart availability checking
- **Error Handling** - Graceful fallbacks and recovery
- **Escalation Logging** - Supabase integration for support tracking
- **AI Chat History** - Context-aware conversations

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- OpenAI API Key for AI features
- Supabase account for escalation logging

### Installation

1. **Clone and setup**
   ```bash
   cd telegrambot
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start the bot**
   ```bash
   npm start
   ```

## 🔧 Configuration

### Environment Variables
```env
# Required - Core Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Required - AI Features
OPENAI_API_KEY=your_openai_api_key_here

# Required - Escalation Logging
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Optional - Backend Integration
BACKEND_API_URL=https://api.eqabo.com
BACKEND_API_KEY=your_backend_api_key_here

# WhatsApp Business API Configuration (Optional)
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_here
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token_here
```

### API Setup Guide

#### 1. Telegram Bot Token
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` command
3. Follow prompts to create your bot
4. Copy the token to `.env`

#### 2. OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com)
2. Create account and navigate to API keys
3. Generate new API key
4. Add to `.env` file

#### 3. Supabase Setup
1. Create account at [Supabase](https://supabase.com)
2. Create new project
3. Get URL and anon key from project settings
4. Add to `.env` file

#### 4. WhatsApp Business API Setup (Optional)
1. Create a Facebook Business Account
2. Set up WhatsApp Business API through [Meta for Developers](https://developers.facebook.com)
3. Get your Access Token, Phone Number ID, and Business Account ID
4. Set up webhook with URL: `https://your-domain.com/webhook/whatsapp`
5. Configure webhook verify token
6. Add all credentials to `.env` file

**WhatsApp Configuration Details:**
```bash
# Required for WhatsApp notifications
WHATSAPP_ACCESS_TOKEN=EAAPTwQfcxfABPswDaTz2Mk4qFtLs6F5MKVYUZAv2MYsTpohMDtpVSj3ZBiMPhONRmYQDHCkfHmbZBKRARDuKhqPO25iyHj6sbykC6GGU7BDwrH4zJIG4tJLsHraCBYdsCdeawnN2mexZB7ColnfV9ehPCVEL89iEMX7z5Cf2V5IqMmzHObgGNwL7OsLh6MuDjDkCVId1d08dufuTKOiCIIziVNIyVsDTdNylE5hl42zvg0M2x2sKBilCLono5gZDZD

WHATSAPP_PHONE_NUMBER_ID=779539541910757

WHATSAPP_BUSINESS_ACCOUNT_ID=1360017022123665

# Webhook verification token (set your own secure token)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_secure_verify_token_here
```

## 📁 Project Structure

```
telegrambot/
├── src/
│   └── bot.js          # Enhanced bot with AI and inline buttons
├── package.json        # Dependencies including OpenAI & Supabase
├── .env.example       # Complete environment template
└── README.md          # This documentation
```

## 💬 Enhanced User Experience

### Smart Start Flow
```
User: /start
Bot: 🌍 Welcome to eQabo.com! Choose your language:
     [English] [አማርኛ] [Soomaali] [Afaan Oromoo] [ትግርኛ] [Qafar af]

User: [English]
Bot: 🏨 Welcome to eQabo.com! What would you like to do?
     [🔍 Search Hotels] [📅 Book Room] [💳 Payment Options] [❓ FAQs] [🆘 Escalate]
```

### AI-Powered FAQ
```
User: [❓ FAQs]
Bot: 📚 Frequently Asked Questions:
     [📋 Booking Policy] [💳 Payment Methods] [📞 Contact Support] 
     [🏨 Hotel Amenities] [✈️ Travel Tips] [🔙 Back to Menu]

User: [📋 Booking Policy]
Bot: 📋 Our booking policy:
     • Free cancellation up to 24 hours before check-in
     • Full refund for cancellations made 48+ hours in advance
     • Partial refund (50%) for 24-48 hour cancellations
     [🔙 Back to Menu]
```

### AI Chat Fallback
```
User: "What's the weather like in Addis Ababa?"
Bot: 🤖 Let me help you with that...
     
     Based on current information, Addis Ababa typically has:
     • Mild temperatures year-round (15-25°C)
     • Rainy season: June-September
     • Dry season: October-May
     
     For real-time weather, I recommend checking local forecasts.
     [🔙 Back to Menu] [🆘 Need Human Help?]
```

## 🛠️ Development

### Adding New Cities
```javascript
ethiopianCities: {
  'new_city': {
    name: 'New City',
    hotels: [
      {
        name: 'Hotel Name',
        rating: 4,
        price: 100,
        amenities: ['WiFi', 'Pool', 'Restaurant']
      }
    ]
  }
}
```

### Extending Knowledge Base
```javascript
knowledgeBase: {
  en: {
    'new_topic': {
      keywords: ['keyword1', 'keyword2'],
      answer: 'Your comprehensive answer here...'
    }
  }
}
```

## 🌐 Production Deployment

### Recommended Stack
- **Hosting**: VPS or cloud platform (AWS, DigitalOcean)
- **Process Manager**: PM2 for production stability
- **Database**: Supabase for escalation logging
- **AI**: OpenAI GPT-4o-mini for intelligent responses
- **Monitoring**: Application performance monitoring

### PM2 Deployment
```bash
npm install -g pm2
pm2 start src/bot.js --name "eqabo-enhanced-bot"
pm2 startup
pm2 save
```

### Monitoring & Analytics
- **User Interactions**: Track button clicks and user flows
- **AI Performance**: Monitor response quality and fallback rates
- **Escalation Metrics**: Analyze support handoff patterns
- **Booking Conversions**: Measure booking completion rates

## 🎯 Key Enhancements Summary

| Feature | Before | After |
|---------|--------|-------|
| **User Input** | Text typing required | Inline buttons everywhere |
| **Date Selection** | Manual text entry | Visual calendar interface |
| **Guest Count** | Type number | Quick selection buttons |
| **FAQ Support** | Basic responses | AI-powered knowledge base |
| **Complex Queries** | Limited responses | GPT-4o-mini integration |
| **Support Escalation** | Manual process | Automated Supabase logging |
| **Navigation** | Linear flow | Smart menu with back options |
| **User Experience** | Chat-based | App-like interface |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test all enhancements thoroughly
4. Submit a pull request with detailed description

## 📞 Support

- **Website**: [eQabo.com](https://eqabo.com)
- **Email**: support@eqabo.com
- **Telegram**: [@eQaboSupport](https://t.me/eQaboSupport)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ and 🤖 AI for Ethiopian hospitality** 🇪🇹