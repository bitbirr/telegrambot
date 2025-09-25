-- Safe Database Migration for eQabo.com Telegram Bot
-- Feedback & Ratings System and Human Escalation Protocol
-- This script safely adds tables and columns without dropping existing data

-- Create ai_feedback table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_feedback') THEN
        CREATE TABLE ai_feedback (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            username VARCHAR(255),
            message_id BIGINT,
            feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('helpful', 'not_helpful')),
            ai_response_text TEXT,
            user_query TEXT,
            language VARCHAR(10) DEFAULT 'en',
            session_context JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Create ai_escalations table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_escalations') THEN
        CREATE TABLE ai_escalations (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            username VARCHAR(255),
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            language VARCHAR(10) DEFAULT 'en',
            escalation_reason TEXT,
            conversation_context JSONB,
            user_message TEXT,
            session_state VARCHAR(50),
            admin_notified BOOLEAN DEFAULT FALSE,
            admin_response TEXT,
            status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
            priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
            assigned_admin_id BIGINT,
            resolved_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Add missing columns to existing tables if they don't exist
DO $$ 
BEGIN
    -- Add user_id to ai_feedback if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_feedback' AND column_name = 'user_id') THEN
        ALTER TABLE ai_feedback ADD COLUMN user_id BIGINT NOT NULL DEFAULT 0;
    END IF;
    
    -- Add user_id to ai_escalations if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_escalations' AND column_name = 'user_id') THEN
        ALTER TABLE ai_escalations ADD COLUMN user_id BIGINT NOT NULL DEFAULT 0;
    END IF;
    
    -- Add other missing columns for ai_feedback
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_feedback' AND column_name = 'username') THEN
        ALTER TABLE ai_feedback ADD COLUMN username VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_feedback' AND column_name = 'message_id') THEN
        ALTER TABLE ai_feedback ADD COLUMN message_id BIGINT;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_feedback' AND column_name = 'feedback_type') THEN
        ALTER TABLE ai_feedback ADD COLUMN feedback_type VARCHAR(20) CHECK (feedback_type IN ('helpful', 'not_helpful'));
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_feedback' AND column_name = 'language') THEN
        ALTER TABLE ai_feedback ADD COLUMN language VARCHAR(10) DEFAULT 'en';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_feedback' AND column_name = 'session_context') THEN
        ALTER TABLE ai_feedback ADD COLUMN session_context JSONB;
    END IF;
    
    -- Add other missing columns for ai_escalations
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_escalations' AND column_name = 'username') THEN
        ALTER TABLE ai_escalations ADD COLUMN username VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_escalations' AND column_name = 'escalation_reason') THEN
        ALTER TABLE ai_escalations ADD COLUMN escalation_reason TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_escalations' AND column_name = 'conversation_context') THEN
        ALTER TABLE ai_escalations ADD COLUMN conversation_context JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_escalations' AND column_name = 'status') THEN
        ALTER TABLE ai_escalations ADD COLUMN status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed'));
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_escalations' AND column_name = 'priority') THEN
        ALTER TABLE ai_escalations ADD COLUMN priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ai_escalations' AND column_name = 'language') THEN
        ALTER TABLE ai_escalations ADD COLUMN language VARCHAR(10) DEFAULT 'en';
    END IF;
END $$;

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user_id ON ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at ON ai_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_type ON ai_feedback(feedback_type);

CREATE INDEX IF NOT EXISTS idx_ai_escalations_user_id ON ai_escalations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_escalations_status ON ai_escalations(status);
CREATE INDEX IF NOT EXISTS idx_ai_escalations_created_at ON ai_escalations(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_escalations_admin_notified ON ai_escalations(admin_notified);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_ai_feedback_updated_at ON ai_feedback;
CREATE TRIGGER update_ai_feedback_updated_at 
    BEFORE UPDATE ON ai_feedback 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_escalations_updated_at ON ai_escalations;
CREATE TRIGGER update_ai_escalations_updated_at 
    BEFORE UPDATE ON ai_escalations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for analytics
CREATE OR REPLACE VIEW feedback_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    feedback_type,
    language,
    COUNT(*) as count,
    COUNT(DISTINCT user_id) as unique_users
FROM ai_feedback 
GROUP BY DATE_TRUNC('day', created_at), feedback_type, language
ORDER BY date DESC;

CREATE OR REPLACE VIEW escalation_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    status,
    priority,
    language,
    COUNT(*) as count,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
FROM ai_escalations 
GROUP BY DATE_TRUNC('day', created_at), status, priority, language
ORDER BY date DESC;