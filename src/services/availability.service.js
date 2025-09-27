import supabase from '../supabase.js';
import { logEvent } from './logService.js';

/**
 * Availability Service
 * Handles room availability checks for booking system
 */
class AvailabilityService {
  /**
   * Check if a room (hotel) is available for the given date range
   * @param {string} room_id - Hotel/Room ID (UUID)
   * @param {string} checkin - Check-in date (YYYY-MM-DD)
   * @param {string} checkout - Check-out date (YYYY-MM-DD)
   * @returns {Promise<boolean>} - True if available, false if not
   */
  async checkRoomAvailability(room_id, checkin, checkout) {
    try {
      if (!room_id || !checkin || !checkout) {
        throw new Error('Missing required parameters: room_id, checkin, checkout');
      }

      // Check if database is available
      if (!supabase) {
        throw new Error('Database service unavailable');
      }

      // Validate date format and logic
      const checkinDate = new Date(checkin);
      const checkoutDate = new Date(checkout);
      
      if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }

      if (checkinDate >= checkoutDate) {
        throw new Error('Check-out date must be after check-in date');
      }

      // Query to count conflicting bookings
      // A booking conflicts if:
      // - It's for the same room (hotel_id = room_id)
      // - Status is 'pending_payment' or 'confirmed'
      // - Date ranges overlap: checkin_date < $checkout AND checkout_date > $checkin
      const { data, error } = await supabase
        .rpc('check_room_availability', {
          room_id_param: room_id,
          checkin_param: checkin,
          checkout_param: checkout
        });

      if (error) {
        // If RPC function doesn't exist, fall back to direct query
        console.warn('RPC function not found, using direct query:', error.message);
        return this.checkAvailabilityDirectQuery(room_id, checkin, checkout);
      }

      const isAvailable = data === 0; // No conflicts means available

      await logEvent('info', 'Room availability checked', {
        room_id,
        checkin,
        checkout,
        available: isAvailable,
        conflicts: data
      });

      return isAvailable;

    } catch (error) {
      await logEvent('error', 'Room availability check failed', {
        error: error.message,
        room_id,
        checkin,
        checkout
      });
      throw error;
    }
  }

  /**
   * Direct SQL query fallback for availability checking
   * @param {string} room_id - Hotel/Room ID
   * @param {string} checkin - Check-in date
   * @param {string} checkout - Check-out date
   * @returns {Promise<boolean>} - Availability status
   */
  async checkAvailabilityDirectQuery(room_id, checkin, checkout) {
    try {
      // Check if database is available
      if (!supabase) {
        throw new Error('Database service unavailable');
      }

      const { count, error } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', room_id)
        .in('status', ['pending_payment', 'confirmed'])
        .lt('check_in_date', checkout)
        .gt('check_out_date', checkin);

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      const isAvailable = count === 0;

      await logEvent('info', 'Room availability checked (direct query)', {
        room_id,
        checkin,
        checkout,
        available: isAvailable,
        conflicts: count
      });

      return isAvailable;

    } catch (error) {
      await logEvent('error', 'Direct availability query failed', {
        error: error.message,
        room_id,
        checkin,
        checkout
      });
      throw error;
    }
  }

  /**
   * Get availability status for multiple rooms/hotels
   * @param {Array} roomIds - Array of hotel/room IDs
   * @param {string} checkin - Check-in date
   * @param {string} checkout - Check-out date
   * @returns {Promise<Object>} - Object with room_id as key and availability as value
   */
  async checkMultipleRoomsAvailability(roomIds, checkin, checkout) {
    try {
      if (!Array.isArray(roomIds) || roomIds.length === 0) {
        return {};
      }

      const results = {};
      
      // Check availability for each room
      await Promise.all(roomIds.map(async (roomId) => {
        try {
          results[roomId] = await this.checkRoomAvailability(roomId, checkin, checkout);
        } catch (error) {
          console.error(`Error checking availability for room ${roomId}:`, error.message);
          results[roomId] = false; // Assume unavailable on error
        }
      }));

      await logEvent('info', 'Multiple rooms availability checked', {
        roomIds: roomIds.length,
        checkin,
        checkout,
        available_count: Object.values(results).filter(Boolean).length
      });

      return results;

    } catch (error) {
      await logEvent('error', 'Multiple rooms availability check failed', {
        error: error.message,
        roomIds: roomIds?.length || 0,
        checkin,
        checkout
      });
      throw error;
    }
  }
}

// Export singleton instance
const availabilityService = new AvailabilityService();
export default availabilityService;