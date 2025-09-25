-- Database Schema for eQabo.com Telegram Bot
-- Feedback & Ratings System and Human Escalation Protocol

-- Drop existing tables if they exist (to ensure clean recreation)
DROP TABLE IF EXISTS ai_feedback CASCADE;
DROP TABLE IF EXISTS ai_escalations CASCADE;

-- Table for storing AI feedback ratings
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

-- Table for storing escalation requests
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
CREATE TRIGGER update_ai_feedback_updated_at 
    BEFORE UPDATE ON ai_feedback 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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