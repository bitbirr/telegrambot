-- Database Diagnostic Script for eQabo.com Telegram Bot
-- Run this to check your current database structure

-- Check if tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name IN ('ai_feedback', 'ai_escalations')
ORDER BY table_name;

-- Check columns in ai_feedback table (if it exists)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ai_feedback'
ORDER BY ordinal_position;

-- Check columns in ai_escalations table (if it exists)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ai_escalations'
ORDER BY ordinal_position;

-- Check existing indexes
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('ai_feedback', 'ai_escalations')
ORDER BY tablename, indexname;

-- Check existing views
SELECT 
    table_name,
    view_definition
FROM information_schema.views 
WHERE table_name IN ('feedback_analytics', 'escalation_analytics');

-- Check existing functions
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'update_updated_at_column';

-- Check existing triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table IN ('ai_feedback', 'ai_escalations');