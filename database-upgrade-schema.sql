-- =====================================================
-- eQabo.com Telegram Bot - Database Upgrade Schema
-- Moving from hardcoded data to dynamic database-driven content
-- =====================================================

-- Enable UUID extension for better primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. KNOWLEDGE BASE TABLE
-- Stores all bot messages and responses in multiple languages
-- =====================================================
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL,
    language VARCHAR(5) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique key-language combinations
    UNIQUE(key, language)
);

-- Index for fast lookups
CREATE INDEX idx_knowledge_base_key_lang ON knowledge_base(key, language);
CREATE INDEX idx_knowledge_base_category ON knowledge_base(category);

-- =====================================================
-- 2. CITIES TABLE
-- Ethiopian cities with multi-language names and coordinates
-- =====================================================
CREATE TABLE cities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'addis_ababa'
    names JSONB NOT NULL, -- {"en": "Addis Ababa", "am": "አዲስ አበባ", ...}
    coordinates JSONB, -- {"latitude": 9.0054, "longitude": 38.7636}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast city lookups
CREATE INDEX idx_cities_key ON cities(key);
CREATE INDEX idx_cities_active ON cities(is_active);

-- =====================================================
-- 3. HOTELS TABLE
-- Hotel information with city relationships, pricing, and media
-- =====================================================
CREATE TABLE hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    price_per_night INTEGER NOT NULL, -- in Ethiopian Birr
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    description JSONB NOT NULL, -- Multi-language descriptions
    images JSONB, -- Array of image URLs
    coordinates JSONB, -- {"latitude": 9.0054, "longitude": 38.7636}
    amenities JSONB, -- Array of amenities
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_hotels_city_id ON hotels(city_id);
CREATE INDEX idx_hotels_price ON hotels(price_per_night);
CREATE INDEX idx_hotels_rating ON hotels(rating);
CREATE INDEX idx_hotels_active ON hotels(is_active);

-- =====================================================
-- 4. PAYMENT METHODS TABLE
-- Payment options with multi-language support
-- =====================================================
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'telebirr'
    translations JSONB NOT NULL, -- {"en": "Telebirr", "am": "ቴሌብር", ...}
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for payment method lookups
CREATE INDEX idx_payment_methods_key ON payment_methods(key);
CREATE INDEX idx_payment_methods_active ON payment_methods(is_active);
CREATE INDEX idx_payment_methods_order ON payment_methods(display_order);

-- =====================================================
-- 5. BOT LOGS TABLE (Enhanced from existing)
-- Comprehensive logging for bot activities
-- =====================================================
CREATE TABLE IF NOT EXISTS bot_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    context JSONB,
    user_id BIGINT,
    session_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for log analysis
CREATE INDEX IF NOT EXISTS idx_bot_logs_level ON bot_logs(level);
CREATE INDEX IF NOT EXISTS idx_bot_logs_user_id ON bot_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_logs_created_at ON bot_logs(created_at);

-- =====================================================
-- 6. USER SESSIONS TABLE (Optional - for persistence)
-- Store user session data in database instead of memory
-- =====================================================
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT UNIQUE NOT NULL,
    language VARCHAR(5) DEFAULT 'en',
    language_explicitly_set BOOLEAN DEFAULT false,
    current_state VARCHAR(50),
    session_data JSONB, -- Store destination, hotel, dates, etc.
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for user session lookups
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity);

-- =====================================================
-- 7. ESCALATIONS TABLE (Enhanced from existing)
-- Track customer support escalations
-- =====================================================
CREATE TABLE IF NOT EXISTS escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    username VARCHAR(100),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    language VARCHAR(5),
    message_id INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(10) DEFAULT 'normal',
    assigned_to VARCHAR(100),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for escalation management
CREATE INDEX IF NOT EXISTS idx_escalations_user_id ON escalations(user_id);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_created_at ON escalations(created_at);

-- =====================================================
-- 8. BOOKINGS TABLE (New - for future booking tracking)
-- Track actual hotel bookings made through the bot
-- =====================================================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    hotel_id UUID NOT NULL REFERENCES hotels(id),
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    guests INTEGER NOT NULL,
    payment_method_id UUID REFERENCES payment_methods(id),
    total_amount INTEGER NOT NULL, -- in Ethiopian Birr
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, cancelled
    booking_reference VARCHAR(50) UNIQUE,
    special_requests TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for booking management
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_hotel_id ON bookings(hotel_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_check_in ON bookings(check_in_date);

-- =====================================================
-- 9. TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cities_updated_at BEFORE UPDATE ON cities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hotels_updated_at BEFORE UPDATE ON hotels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. ROW LEVEL SECURITY (Optional - for multi-tenancy)
-- =====================================================
-- Enable RLS on sensitive tables if needed
-- ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SCHEMA CREATION COMPLETE
-- =====================================================
-- Next steps:
-- 1. Run this schema in your Supabase database
-- 2. Populate tables with existing hardcoded data
-- 3. Update bot code to use database queries
-- 4. Test the new dynamic system
-- =====================================================