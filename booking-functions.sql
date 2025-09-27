-- =====================================================
-- Booking System Functions with Concurrency Safety
-- Advisory locks and booking creation functions
-- =====================================================

-- Function to create booking with advisory lock for concurrency safety
CREATE OR REPLACE FUNCTION create_booking_with_lock(
  p_hotel_id UUID,
  p_user_id BIGINT,
  p_checkin DATE,
  p_checkout DATE,
  p_guests INTEGER,
  p_user_details JSONB DEFAULT '{}'::JSONB
) RETURNS TABLE(
  id UUID,
  booking_reference VARCHAR,
  hotel_id UUID,
  hotel_name VARCHAR,
  check_in_date DATE,
  check_out_date DATE,
  guests INTEGER,
  total_amount INTEGER,
  nights INTEGER,
  price_per_night INTEGER,
  status VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_hotel RECORD;
  v_nights INTEGER;
  v_total_amount INTEGER;
  v_booking_ref VARCHAR;
  v_booking_id UUID;
  v_lock_id BIGINT;
  v_conflict_count INTEGER;
BEGIN
  -- Generate lock ID from hotel UUID (use hashtext for consistent hashing)
  SELECT hashtext(p_hotel_id::TEXT) INTO v_lock_id;
  
  -- Acquire advisory lock for the room/hotel
  PERFORM pg_advisory_xact_lock(v_lock_id);
  
  -- Re-check availability within the lock
  SELECT COUNT(*) INTO v_conflict_count
  FROM bookings b
  WHERE b.hotel_id = p_hotel_id
    AND b.status IN ('pending_payment', 'confirmed')
    AND b.check_in_date < p_checkout
    AND b.check_out_date > p_checkin;
  
  -- If room is not available, raise exception
  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Room is no longer available for the selected dates';
  END IF;
  
  -- Get hotel details
  SELECT h.id, h.name, h.price_per_night
  INTO v_hotel
  FROM hotels h
  WHERE h.id = p_hotel_id AND h.is_active = true;
  
  -- Check if hotel exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hotel not found or inactive';
  END IF;
  
  -- Calculate nights and total amount
  v_nights := p_checkout - p_checkin;
  v_total_amount := v_nights * v_hotel.price_per_night;
  
  -- Generate booking reference
  v_booking_ref := 'BK' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 10));
  
  -- Generate booking ID
  v_booking_id := uuid_generate_v4();
  
  -- Insert booking
  INSERT INTO bookings (
    id,
    user_id,
    hotel_id,
    check_in_date,
    check_out_date,
    guests,
    total_price,
    status,
    booking_reference,
    user_details,
    created_at,
    updated_at
  ) VALUES (
    v_booking_id,
    p_user_id,
    p_hotel_id,
    p_checkin,
    p_checkout,
    p_guests,
    v_total_amount,
    'pending_payment',
    v_booking_ref,
    p_user_details,
    NOW(),
    NOW()
  );
  
  -- Return booking details
  RETURN QUERY SELECT
    v_booking_id,
    v_booking_ref,
    p_hotel_id,
    v_hotel.name,
    p_checkin,
    p_checkout,
    p_guests,
    v_total_amount,
    v_nights,
    v_hotel.price_per_night,
    'pending_payment'::VARCHAR,
    NOW();
    
END;
$$ LANGUAGE plpgsql;

-- Function to check room availability (if not exists from availability service)
CREATE OR REPLACE FUNCTION check_room_availability(
  room_id_param UUID,
  checkin_param DATE,
  checkout_param DATE
) RETURNS INTEGER AS $$
DECLARE
  conflict_count INTEGER;
BEGIN
  -- Count conflicting bookings
  SELECT COUNT(*)
  INTO conflict_count
  FROM bookings
  WHERE hotel_id = room_id_param
    AND status IN ('pending_payment', 'confirmed')
    AND check_in_date < checkout_param
    AND check_out_date > checkin_param;
    
  RETURN conflict_count;
END;
$$ LANGUAGE plpgsql;

-- Wrapper for PostgreSQL advisory lock function
CREATE OR REPLACE FUNCTION pg_advisory_xact_lock(lock_id BIGINT)
RETURNS VOID AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(lock_id);
END;
$$ LANGUAGE plpgsql;