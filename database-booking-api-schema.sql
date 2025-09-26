-- =====================================================
-- eQabo.com Telegram Bot - Booking API Schema Extension
-- Adding rooms and payments tables for booking workflow API
-- =====================================================

-- =====================================================
-- ROOMS TABLE
-- Room inventory and availability tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    room_type VARCHAR(50) NOT NULL, -- e.g., 'standard', 'deluxe', 'suite'
    room_number VARCHAR(20), -- Optional room number
    capacity INTEGER NOT NULL DEFAULT 2, -- Number of guests
    price_per_night INTEGER NOT NULL, -- in Ethiopian Birr
    amenities JSONB, -- Array of room amenities
    images JSONB, -- Array of room images
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for room queries
CREATE INDEX IF NOT EXISTS idx_rooms_hotel_id ON rooms(hotel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_available ON rooms(is_available);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(room_type);

-- =====================================================
-- ROOM BOOKINGS (Reserved dates)
-- Track which rooms are booked for which dates
-- =====================================================
CREATE TABLE IF NOT EXISTS room_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure no overlapping bookings for the same room
    CONSTRAINT no_room_overlap EXCLUDE USING gist (
        room_id WITH =,
        daterange(check_in_date, check_out_date, '[)') WITH &&
    ) WHERE (status = 'active')
);

-- Indexes for room booking queries
CREATE INDEX IF NOT EXISTS idx_room_bookings_room_id ON room_bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_room_bookings_booking_id ON room_bookings(booking_id);
CREATE INDEX IF NOT EXISTS idx_room_bookings_dates ON room_bookings(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_room_bookings_status ON room_bookings(status);

-- =====================================================
-- PAYMENTS TABLE
-- Payment tracking for bookings
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES payment_methods(id),
    amount INTEGER NOT NULL, -- in Ethiopian Birr
    currency VARCHAR(3) DEFAULT 'ETB',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled')),
    provider_transaction_id VARCHAR(255), -- Transaction ID from payment provider
    provider_reference VARCHAR(255), -- Reference from payment provider  
    payment_url TEXT, -- Payment URL for user to complete payment
    callback_data JSONB, -- Data received from payment callback
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for payment queries
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON payments(provider_reference);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(provider_transaction_id);

-- =====================================================
-- UPDATE EXISTING BOOKINGS TABLE
-- Add payment status and booking reference generation
-- =====================================================

-- Add payment_status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_status') THEN
        ALTER TABLE bookings ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'success', 'failed'));
    END IF;
END $$;

-- Add room_id column to link bookings to specific rooms
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='room_id') THEN
        ALTER TABLE bookings ADD COLUMN room_id UUID REFERENCES rooms(id);
    END IF;
END $$;

-- =====================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================================

-- Apply triggers to new tables
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_room_bookings_updated_at BEFORE UPDATE ON room_bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- BOOKING REFERENCE GENERATION FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate booking reference if not provided
    IF NEW.booking_reference IS NULL THEN
        NEW.booking_reference := 'EQB-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTR(NEW.id::text, 1, 8));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply booking reference generation trigger
DROP TRIGGER IF EXISTS generate_booking_reference_trigger ON bookings;
CREATE TRIGGER generate_booking_reference_trigger 
    BEFORE INSERT ON bookings 
    FOR EACH ROW EXECUTE FUNCTION generate_booking_reference();

-- =====================================================
-- ROOM AVAILABILITY CHECK FUNCTION
-- Helper function to check room availability
-- =====================================================
CREATE OR REPLACE FUNCTION check_room_availability(
    p_room_id UUID,
    p_check_in DATE,
    p_check_out DATE
) 
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if room has any overlapping active bookings
    RETURN NOT EXISTS (
        SELECT 1 FROM room_bookings 
        WHERE room_id = p_room_id 
        AND status = 'active'
        AND daterange(check_in_date, check_out_date, '[)') && daterange(p_check_in, p_check_out, '[)')
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS FOR API ENDPOINTS
-- =====================================================

-- Room availability view
CREATE OR REPLACE VIEW room_availability AS
SELECT 
    r.*,
    h.name as hotel_name,
    h.city_id,
    c.names as city_names,
    c.key as city_key,
    CASE WHEN r.is_available THEN 'available' ELSE 'unavailable' END as availability_status
FROM rooms r
JOIN hotels h ON r.hotel_id = h.id
JOIN cities c ON h.city_id = c.id
WHERE r.is_available = true;

-- Booking details view with payment info
CREATE OR REPLACE VIEW booking_details AS
SELECT 
    b.*,
    h.name as hotel_name,
    c.names as city_names,
    c.key as city_key,
    r.room_type,
    r.room_number,
    pm.translations as payment_method_name,
    p.status as payment_status,
    p.amount as payment_amount,
    p.provider_reference as payment_reference
FROM bookings b
JOIN hotels h ON b.hotel_id = h.id
JOIN cities c ON h.city_id = c.id
LEFT JOIN rooms r ON b.room_id = r.id
LEFT JOIN payment_methods pm ON b.payment_method_id = pm.id
LEFT JOIN payments p ON b.id = p.booking_id;

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- This would typically be populated through API calls
-- =====================================================

-- Insert sample rooms (only if tables are empty)
INSERT INTO rooms (hotel_id, room_type, capacity, price_per_night, amenities, is_available)
SELECT h.id, 'standard', 2, h.price_per_night, '["WiFi", "TV", "AC"]'::jsonb, true
FROM hotels h
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE hotel_id = h.id)
LIMIT 5; -- Add a few sample rooms per hotel

INSERT INTO rooms (hotel_id, room_type, capacity, price_per_night, amenities, is_available)
SELECT h.id, 'deluxe', 3, h.price_per_night + 500, '["WiFi", "TV", "AC", "Mini Bar", "Balcony"]'::jsonb, true
FROM hotels h
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE hotel_id = h.id AND room_type = 'deluxe')
LIMIT 3; -- Add deluxe rooms

-- =====================================================
-- SCHEMA EXTENSION COMPLETE
-- =====================================================