# Notification & Escalation System Setup Guide

This guide will help you set up the notification and escalation system for the eQabo Telegram bot.

## 🚀 Quick Setup

### 1. Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Required - Core Bot Configuration
BOT_TOKEN=your_telegram_bot_token_from_botfather
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Required - AI Service
OPENAI_API_KEY=sk-your_openai_api_key

# Optional - Email Notifications (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional - Admin Notifications
ADMIN_GROUP_ID=-1001234567890
ADMIN_USER_IDS=123456789,987654321

# Optional - Environment
NODE_ENV=development
PORT=3000
```

### 2. Database Setup

Run the database setup script to create required tables:

```bash
# Apply database schema
node create-notification-tables.sql
```

Or manually run the SQL in your Supabase SQL editor.

### 3. Validate Configuration

Check if your environment is properly configured:

```bash
node validate-env.js
```

### 4. Test the System

Run the comprehensive test suite:

```bash
node test-notifications.js
```

## 📋 Detailed Setup Instructions

### Getting Telegram Bot Token

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the instructions
3. Copy the bot token (format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)
4. Add it to your `.env` file as `BOT_TOKEN`

### Getting Supabase Credentials

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings > API
4. Copy:
   - Project URL → `SUPABASE_URL`
   - Anon public key → `SUPABASE_ANON_KEY`
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`

### Setting up Email Notifications (Optional)

For Gmail SMTP:
1. Enable 2-factor authentication on your Google account
2. Generate an App Password:
   - Go to Google Account settings
   - Security > 2-Step Verification > App passwords
   - Generate password for "Mail"
3. Use your Gmail address as `SMTP_USER`
4. Use the generated app password as `SMTP_PASS`

### Getting Admin Group ID (Optional)

1. Add your bot to a Telegram group
2. Send a message in the group
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id":-1001234567890}` in the response
5. Use the negative number as `ADMIN_GROUP_ID`

## 🔧 Troubleshooting

### Common Issues

#### "Telegram bot token missing"
- Ensure `BOT_TOKEN` is set in your `.env` file
- Verify the token format is correct

#### "Database error: new row violates row-level security policy"
- Run the database fix script: `node fix-notification-db.js`
- Or manually update RLS policies in Supabase

#### "Booking confirmation email failed"
- Check SMTP credentials are correct
- Verify Gmail app password if using Gmail
- Test with a simple email first

#### "Health check failed"
- Ensure all required environment variables are set
- Check database connectivity
- Verify Supabase service is running

### Database Issues

If you encounter database-related errors:

1. **Missing Tables**: Run `node create-notification-tables.sql`
2. **Permission Issues**: Run `node fix-notification-db.js`
3. **Column Errors**: Check if all migrations are applied

### Testing Individual Components

Test specific components:

```bash
# Test notification service only
node -e "
import notificationService from './src/services/notificationService.js';
await notificationService.initialize();
console.log('✅ Notification service working');
"

# Test escalation service only
node -e "
import escalationService from './src/services/escalationService.js';
const result = await escalationService.shouldEscalate({
  userId: 123456789,
  query: 'I need human help',
  failureCount: 0
});
console.log('✅ Escalation service working:', result);
"
```

## 🎯 Feature Overview

### ✅ What's Working

- **Notification Service**: Email and Telegram notifications
- **Escalation System**: AI to human handoff logic
- **Monitoring Service**: Error tracking and alerts
- **Configuration Management**: Centralized settings
- **Logging Integration**: Comprehensive event logging
- **Retry Logic**: Automatic retry for failed operations

### 🚀 Available Features

1. **Email Notifications**
   - Booking confirmations
   - Critical error alerts
   - Escalation notifications

2. **Telegram Notifications**
   - Admin group alerts
   - Real-time notifications
   - Formatted messages with emojis

3. **Escalation Triggers**
   - Consecutive AI failures
   - Human request keywords
   - Complex query detection
   - Error rate thresholds

4. **Monitoring & Alerts**
   - Critical error detection
   - Performance monitoring
   - Service health checks
   - Automatic notifications

## 📞 Support

If you encounter issues:

1. Check the logs in your terminal
2. Run `node validate-env.js` to verify configuration
3. Review the test results from `node test-notifications.js`
4. Check Supabase logs for database issues

The system is designed to be resilient and will continue working even if some features are not configured (e.g., email notifications will be skipped if SMTP is not configured).