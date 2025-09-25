-- =====================================================
-- Fix Database Issues for eQabo.com Telegram Bot
-- =====================================================

-- First, disable RLS on problematic tables to fix infinite recursion
ALTER TABLE IF EXISTS hotels DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cities DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS knowledge_base DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_methods_bot DISABLE ROW LEVEL SECURITY;

-- Drop any problematic policies
DROP POLICY IF EXISTS "Enable read access for all users" ON hotels;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON hotels;
DROP POLICY IF EXISTS "Enable update for users based on email" ON hotels;

-- Rename payment_methods_bot to payment_methods if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_methods_bot') THEN
        ALTER TABLE payment_methods_bot RENAME TO payment_methods;
    END IF;
END $$;

-- Create hotels table if it doesn't exist or recreate it
DROP TABLE IF EXISTS hotels CASCADE;
CREATE TABLE hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    price_per_night INTEGER NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    description JSONB NOT NULL,
    images JSONB,
    coordinates JSONB,
    amenities JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for hotels table
CREATE INDEX IF NOT EXISTS idx_hotels_city_id ON hotels(city_id);
CREATE INDEX IF NOT EXISTS idx_hotels_price ON hotels(price_per_night);
CREATE INDEX IF NOT EXISTS idx_hotels_rating ON hotels(rating);
CREATE INDEX IF NOT EXISTS idx_hotels_active ON hotels(is_active);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    language VARCHAR(5) DEFAULT 'en',
    current_state VARCHAR(50),
    session_data JSONB,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    guests INTEGER NOT NULL,
    total_price INTEGER NOT NULL,
    payment_method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    booking_reference VARCHAR(20) UNIQUE,
    user_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_hotel_id ON bookings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_reference ON bookings(booking_reference);

-- Enable simple RLS policies for public read access
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create simple policies for public read access
CREATE POLICY "Enable read access for all users" ON hotels FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON cities FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON knowledge_base FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON payment_methods FOR SELECT USING (true);

-- Allow authenticated users to manage their own sessions and bookings
CREATE POLICY "Users can manage their own sessions" ON user_sessions FOR ALL USING (true);
CREATE POLICY "Users can manage their own bookings" ON bookings FOR ALL USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON user_sessions, bookings, bot_logs, ai_feedback, ai_escalations TO authenticated;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';