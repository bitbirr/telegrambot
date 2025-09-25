-- Create missing tables for notification and escalation system
-- Run this script in your Supabase SQL editor

-- Create escalations table
CREATE TABLE IF NOT EXISTS public.escalations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id BIGINT NOT NULL,
    username TEXT,
    query TEXT NOT NULL,
    reason TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    details TEXT,
    conversation_history JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_agent TEXT,
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL,
    recipient TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Create query_analytics table for monitoring
CREATE TABLE IF NOT EXISTS public.query_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id BIGINT,
    query TEXT NOT NULL,
    response_time INTEGER,
    tokens_used INTEGER,
    cost_estimate DECIMAL(10,6),
    method TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    language TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_escalations_user_id ON public.escalations(user_id);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON public.escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_priority ON public.escalations(priority);
CREATE INDEX IF NOT EXISTS idx_escalations_created_at ON public.escalations(created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient);

CREATE INDEX IF NOT EXISTS idx_query_analytics_user_id ON public.query_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_query_analytics_created_at ON public.query_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_query_analytics_success ON public.query_analytics(success);

-- Create updated_at trigger for escalations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_escalations_updated_at 
    BEFORE UPDATE ON public.escalations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY "Service role can manage escalations" ON public.escalations
    FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'anon');

CREATE POLICY "Service role can manage notifications" ON public.notifications
    FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'anon');

CREATE POLICY "Service role can manage query analytics" ON public.query_analytics
    FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'anon');

-- Grant permissions to service role
GRANT ALL ON public.escalations TO service_role;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.query_analytics TO service_role;

-- Insert sample data for testing (optional)
INSERT INTO public.escalations (user_id, username, query, reason, priority, details, status) VALUES
(123456789, 'test_user', 'I need help with my booking', 'manual_request', 'medium', 'User requested human assistance', 'pending')
ON CONFLICT DO NOTHING;

INSERT INTO public.notifications (type, recipient, channel, status, message) VALUES
('test', 'admin_group', 'telegram', 'sent', 'Test notification message')
ON CONFLICT DO NOTHING;

-- Verify tables were created
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('escalations', 'notifications', 'query_analytics')
ORDER BY tablename;