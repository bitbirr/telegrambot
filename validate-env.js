#!/usr/bin/env node

/**
 * Environment Variables Validation Script
 * Checks if all required environment variables are properly configured
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const requiredVars = {
    // Core Bot Configuration
    'BOT_TOKEN': {
        description: 'Telegram Bot Token from @BotFather',
        required: true,
        example: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz'
    },
    
    // Supabase Configuration
    'SUPABASE_URL': {
        description: 'Supabase Project URL',
        required: true,
        example: 'https://your-project.supabase.co'
    },
    'SUPABASE_ANON_KEY': {
        description: 'Supabase Anonymous Key',
        required: true,
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    },
    'SUPABASE_SERVICE_ROLE_KEY': {
        description: 'Supabase Service Role Key (for admin operations)',
        required: true,
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    },
    
    // AI Service Configuration
    'OPENAI_API_KEY': {
        description: 'OpenAI API Key for AI responses',
        required: true,
        example: 'sk-...'
    },
    'PUTER_API_KEY': {
        description: 'Puter AI API Key (alternative AI service)',
        required: false,
        example: 'puter_...'
    },
    
    // Email Configuration (SMTP)
    'SMTP_HOST': {
        description: 'SMTP Server Host',
        required: false,
        default: 'smtp.supabase.co',
        example: 'smtp.gmail.com'
    },
    'SMTP_PORT': {
        description: 'SMTP Server Port',
        required: false,
        default: '587',
        example: '587'
    },
    'SMTP_USER': {
        description: 'SMTP Username/Email',
        required: false,
        example: 'your-email@domain.com'
    },
    'SMTP_PASS': {
        description: 'SMTP Password/App Password',
        required: false,
        example: 'your-app-password'
    },
    
    // Admin Configuration
    'ADMIN_GROUP_ID': {
        description: 'Telegram Group ID for admin notifications',
        required: false,
        example: '-1001234567890'
    },
    'ADMIN_USER_IDS': {
        description: 'Comma-separated list of admin user IDs',
        required: false,
        example: '123456789,987654321'
    },
    
    // Optional Configuration
    'NODE_ENV': {
        description: 'Environment mode',
        required: false,
        default: 'development',
        example: 'production'
    },
    'PORT': {
        description: 'Server port for health checks',
        required: false,
        default: '3000',
        example: '3000'
    },
    
    // WhatsApp Business API Configuration
    'WHATSAPP_ACCESS_TOKEN': {
        description: 'WhatsApp Business API Access Token',
        required: false,
        example: 'EAAPTwQfcxfABPswDaTz...'
    },
    'WHATSAPP_PHONE_NUMBER_ID': {
        description: 'WhatsApp Business Phone Number ID',
        required: false,
        example: '779539541910757'
    },
    'WHATSAPP_BUSINESS_ACCOUNT_ID': {
        description: 'WhatsApp Business Account ID',
        required: false,
        example: '1360017022123665'
    },
    'WHATSAPP_WEBHOOK_VERIFY_TOKEN': {
        description: 'WhatsApp Webhook Verify Token',
        required: false,
        example: 'your_secure_verify_token'
    }
};

function validateEnvironment() {
    console.log('🔍 Validating Environment Configuration...\n');
    
    let hasErrors = false;
    let hasWarnings = false;
    
    // Check required variables
    console.log('📋 Required Variables:');
    for (const [varName, config] of Object.entries(requiredVars)) {
        const value = process.env[varName];
        const hasValue = value && value.trim() !== '';
        
        if (config.required) {
            if (hasValue) {
                console.log(`✅ ${varName}: Configured`);
            } else {
                console.log(`❌ ${varName}: MISSING (Required)`);
                console.log(`   Description: ${config.description}`);
                if (config.example) {
                    console.log(`   Example: ${config.example}`);
                }
                hasErrors = true;
            }
        } else {
            if (hasValue) {
                console.log(`✅ ${varName}: Configured`);
            } else {
                console.log(`⚠️  ${varName}: Not set (Optional)`);
                console.log(`   Description: ${config.description}`);
                if (config.default) {
                    console.log(`   Default: ${config.default}`);
                }
                hasWarnings = true;
            }
        }
        console.log('');
    }
    
    // Feature availability check
    console.log('🚀 Feature Availability:');
    
    const features = {
        'Basic Bot Functions': process.env.BOT_TOKEN && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY,
        'AI Responses': process.env.OPENAI_API_KEY || process.env.PUTER_API_KEY,
        'Email Notifications': process.env.SMTP_USER && process.env.SMTP_PASS,
        'Admin Notifications': process.env.ADMIN_GROUP_ID,
        'Database Operations': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Production Ready': process.env.NODE_ENV === 'production' && !hasErrors
    };
    
    for (const [feature, available] of Object.entries(features)) {
        console.log(`${available ? '✅' : '❌'} ${feature}`);
    }
    
    console.log('\n' + '='.repeat(50));
    
    if (hasErrors) {
        console.log('❌ Configuration has ERRORS. Please fix the missing required variables.');
        console.log('💡 Create a .env file in the project root with the required variables.');
        return false;
    } else if (hasWarnings) {
        console.log('⚠️  Configuration is valid but some optional features are disabled.');
        console.log('✅ Bot can start with current configuration.');
        return true;
    } else {
        console.log('✅ All environment variables are properly configured!');
        console.log('🚀 Bot is ready to launch with all features enabled.');
        return true;
    }
}

function generateEnvTemplate() {
    console.log('\n📝 Environment Template (.env file):');
    console.log('='.repeat(50));
    
    for (const [varName, config] of Object.entries(requiredVars)) {
        console.log(`# ${config.description}`);
        if (config.example) {
            console.log(`# Example: ${config.example}`);
        }
        if (config.default) {
            console.log(`${varName}=${config.default}`);
        } else {
            console.log(`${varName}=`);
        }
        console.log('');
    }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const isValid = validateEnvironment();
    
    if (!isValid || process.argv.includes('--template')) {
        generateEnvTemplate();
    }
    
    process.exit(isValid ? 0 : 1);
}

export { validateEnvironment, requiredVars };