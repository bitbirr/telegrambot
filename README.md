# telegrambot

eQabo.com Hotel Assistant Telegram Bot with human escalation support.

## Features

- **Hotel Assistant**: AI-powered assistance for hotel bookings and inquiries
- **Talk to Human**: Escalation button to connect users with human support
- **Database Integration**: Escalations saved to Supabase for tracking
- **Admin Notifications**: Optional Telegram notifications to administrators

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

   Required variables:
   - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
   - `OPENAI_API_KEY`: OpenAI API key for AI responses
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anon key

   Optional variables:
   - `ADMIN_TELEGRAM_ID`: Telegram user ID to receive escalation notifications

3. **Database Setup:**
   Create the following table in your Supabase database:
   ```sql
   CREATE TABLE ai_escalations (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id text NOT NULL,
     reason text NOT NULL,
     created_at timestamp with time zone DEFAULT now(),
     resolved boolean DEFAULT false
   );
   ```

## Usage

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

## Talk to Human Feature

Users can click the "💬 Talk to Human" button in any chat to:
- Create an escalation record in the database
- Notify administrators (if configured)
- Receive a confirmation with reference ID

The button appears automatically on:
- `/start` command responses
- `/help` command responses  
- Regular text message responses