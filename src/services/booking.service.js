import supabase from '../supabase.js';
import { logEvent } from './logService.js';
import availabilityService from './availability.service.js';

/**
 * Booking Service
 * Handles booking creation with concurrency safety using PostgreSQL advisory locks
 */
class BookingService {
  /**
   * Create a new booking with concurrency safety
   * @param {Object} bookingData - Booking information
   * @param {string} bookingData.hotelId - Hotel/Room ID
   * @param {string} bookingData.roomId - Room ID (same as hotelId in this system)
   * @param {string} bookingData.checkin - Check-in date (YYYY-MM-DD)
   * @param {string} bookingData.checkout - Check-out date (YYYY-MM-DD)
   * @param {number} bookingData.guests - Number of guests
   * @param {number} bookingData.userId - User ID
   * @param {Object} bookingData.userDetails - User details (optional)
   * @returns {Promise<Object>} - Created booking with id and amount
   */
  async createBooking(bookingData) {
    try {
      const { hotelId, roomId, checkin, checkout, guests, userId, userDetails = {} } = bookingData;

      // Validate required fields
      if (!hotelId || !roomId || !checkin || !checkout || guests === undefined || guests === null || !userId) {
        throw new Error('Missing required booking data: hotelId, roomId, checkin, checkout, guests, userId');
      }

      // Validate dates first
      const checkinDate = new Date(checkin);
      const checkoutDate = new Date(checkout);
      
      if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }

      if (checkinDate >= checkoutDate) {
        throw new Error('Check-out date must be after check-in date');
      }

      // Validate guests
      if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
        throw new Error('Guests must be a number between 1 and 20');
      }

      if (checkinDate < new Date(new Date().toDateString())) {
        throw new Error('Check-in date cannot be in the past');
      }

      // Check if database is available
      if (!supabase) {
        throw new Error('Database service unavailable');
      }

      // Use roomId for consistency with availability service
      const effectiveRoomId = roomId || hotelId;

      // Start a transaction with advisory lock for concurrency safety
      const result = await this._createBookingWithLock(
        effectiveRoomId,
        checkin,
        checkout,
        guests,
        userId,
        userDetails
      );

      await logEvent('info', 'Booking created successfully', {
        booking_id: result.id,
        hotel_id: effectiveRoomId,
        user_id: userId,
        checkin,
        checkout,
        guests,
        total_amount: result.total_amount
      });

      return result;

    } catch (error) {
      await logEvent('error', 'Booking creation failed', {
        error: error.message,
        booking_data: {
          hotelId: bookingData.hotelId,
          roomId: bookingData.roomId,
          checkin: bookingData.checkin,
          checkout: bookingData.checkout,
          guests: bookingData.guests,
          userId: bookingData.userId
        }
      });
      throw error;
    }
  }

  /**
   * Create booking with advisory lock for concurrency safety
   * @private
   */
  async _createBookingWithLock(roomId, checkin, checkout, guests, userId, userDetails) {
    // Execute transaction with advisory lock
    const { data, error } = await supabase.rpc('create_booking_with_lock', {
      p_hotel_id: roomId,
      p_user_id: userId,
      p_checkin: checkin,
      p_checkout: checkout,
      p_guests: guests,
      p_user_details: userDetails
    });

    if (error) {
      // If RPC function doesn't exist, fall back to manual transaction
      console.warn('RPC function not found, using manual transaction:', error.message);
      return this._createBookingManualTransaction(roomId, checkin, checkout, guests, userId, userDetails);
    }

    if (!data || data.length === 0) {
      throw new Error('Failed to create booking - no data returned');
    }

    return data[0];
  }

  /**
   * Manual transaction fallback for booking creation
   * @private
   */
  async _createBookingManualTransaction(roomId, checkin, checkout, guests, userId, userDetails) {
    try {
      // Generate hash for advisory lock based on room ID
      const lockId = this._generateLockId(roomId);

      // Step 1: Acquire advisory lock
      const { data: lockData, error: lockError } = await supabase
        .rpc('pg_advisory_xact_lock', { lock_id: lockId });

      if (lockError) {
        throw new Error(`Failed to acquire lock: ${lockError.message}`);
      }

      // Step 2: Re-check availability within the lock
      const isAvailable = await availabilityService.checkAvailabilityDirectQuery(
        roomId, 
        checkin, 
        checkout
      );

      if (!isAvailable) {
        throw new Error('Room is no longer available for the selected dates');
      }

      // Step 3: Get hotel details for pricing
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .select('id, name, price_per_night')
        .eq('id', roomId)
        .eq('is_active', true)
        .single();

      if (hotelError || !hotel) {
        throw new Error('Hotel not found or inactive');
      }

      // Step 4: Calculate total amount
      const checkinDate = new Date(checkin);
      const checkoutDate = new Date(checkout);
      const nights = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
      const totalAmount = nights * hotel.price_per_night;

      // Step 5: Generate booking reference
      const bookingReference = this._generateBookingReference();

      // Step 6: Insert booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: userId,
          hotel_id: roomId,
          check_in_date: checkin,
          check_out_date: checkout,
          guests: guests,
          total_price: totalAmount, // Use total_price based on schema
          status: 'pending_payment',
          booking_reference: bookingReference,
          user_details: userDetails,
          payment_method: null // Will be set when payment is processed
        })
        .select()
        .single();

      if (bookingError) {
        throw new Error(`Failed to create booking: ${bookingError.message}`);
      }

      // Return booking with consistent field names
      return {
        id: booking.id,
        booking_reference: booking.booking_reference,
        hotel_id: booking.hotel_id,
        hotel_name: hotel.name,
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
        guests: booking.guests,
        total_amount: booking.total_price, // Map total_price to total_amount for API consistency
        nights: nights,
        price_per_night: hotel.price_per_night,
        status: booking.status,
        created_at: booking.created_at
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get booking by ID with hotel and room details
   * @param {string} bookingId - Booking ID
   * @returns {Promise<Object>} - Booking with hotel and room information
   */
  async getBookingById(bookingId) {
    try {
      if (!bookingId) {
        throw new Error('Booking ID is required');
      }

      // Check if database is available
      if (!supabase) {
        throw new Error('Database service unavailable');
      }

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          hotels!inner(
            id,
            name,
            price_per_night,
            rating,
            description,
            images,
            coordinates,
            amenities,
            cities!inner(id, key, names)
          )
        `)
        .eq('id', bookingId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Booking not found');
        }
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Calculate nights
      const checkinDate = new Date(data.check_in_date);
      const checkoutDate = new Date(data.check_out_date);
      const nights = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));

      // Format response
      const booking = {
        id: data.id,
        booking_reference: data.booking_reference,
        user_id: data.user_id,
        status: data.status,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        guests: data.guests,
        nights: nights,
        total_amount: data.total_price, // Map total_price to total_amount
        payment_method: data.payment_method,
        special_requests: data.special_requests,
        user_details: data.user_details,
        created_at: data.created_at,
        updated_at: data.updated_at,
        hotel: {
          id: data.hotels.id,
          name: data.hotels.name,
          price_per_night: data.hotels.price_per_night,
          rating: data.hotels.rating,
          description: data.hotels.description,
          images: data.hotels.images || [],
          coordinates: data.hotels.coordinates,
          amenities: data.hotels.amenities || [],
          city: {
            id: data.hotels.cities.id,
            key: data.hotels.cities.key,
            name: data.hotels.cities.names
          }
        },
        // For compatibility, include room info (same as hotel in this system)
        room: {
          id: data.hotels.id,
          name: data.hotels.name,
          price_per_night: data.hotels.price_per_night,
          rating: data.hotels.rating
        }
      };

      await logEvent('info', 'Booking retrieved', {
        booking_id: bookingId,
        user_id: data.user_id,
        hotel_id: data.hotel_id
      });

      return booking;

    } catch (error) {
      await logEvent('error', 'Get booking failed', {
        error: error.message,
        booking_id: bookingId
      });
      throw error;
    }
  }

  /**
   * Generate a lock ID for advisory locking based on room ID
   * @private
   */
  _generateLockId(roomId) {
    // Create a simple hash of the room ID for the lock
    // PostgreSQL advisory locks use bigint, so we need a numeric ID
    let hash = 0;
    if (roomId.length === 0) return hash;
    for (let i = 0; i < roomId.length; i++) {
      const char = roomId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate a unique booking reference
   * @private
   */
  _generateBookingReference() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `BK${timestamp}${random}`;
  }
}

// Export singleton instance
const bookingService = new BookingService();
export default bookingService;