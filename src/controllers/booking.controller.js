import bookingService from '../services/booking.service.js';
import { logEvent } from '../services/logService.js';

/**
 * Booking Controller
 * Handles HTTP requests for booking operations
 */
class BookingController {
  /**
   * Create a new booking
   * POST /api/bookings
   * Body: {hotelId, roomId, checkin, checkout, guests, userId?, userDetails?}
   */
  async createBooking(req, res) {
    try {
      const { hotelId, roomId, checkin, checkout, guests, userId, userDetails } = req.body;

      // Validate required fields
      if (!hotelId || !roomId || !checkin || !checkout || !guests) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'hotelId, roomId, checkin, checkout, and guests are required',
          timestamp: new Date().toISOString()
        });
      }

      // Use a default userId if not provided (for testing purposes)
      const effectiveUserId = userId || 999999999; // Default test user ID

      // Create booking
      const booking = await bookingService.createBooking({
        hotelId,
        roomId,
        checkin,
        checkout,
        guests,
        userId: effectiveUserId,
        userDetails: userDetails || {}
      });

      await logEvent('info', 'Booking created via API', {
        booking_id: booking.id,
        hotel_id: hotelId,
        user_id: effectiveUserId,
        endpoint: 'POST /api/bookings'
      });

      // Return booking payload for front-end
      res.status(201).json({
        success: true,
        data: {
          id: booking.id,
          booking_reference: booking.booking_reference,
          hotel_id: booking.hotel_id,
          hotel_name: booking.hotel_name,
          check_in_date: booking.check_in_date,
          check_out_date: booking.check_out_date,
          guests: booking.guests,
          nights: booking.nights,
          price_per_night: booking.price_per_night,
          amount: booking.total_amount, // Amount for payment processing
          total_amount: booking.total_amount,
          status: booking.status,
          created_at: booking.created_at
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      await logEvent('error', 'Create booking API failed', {
        error: error.message,
        request_body: req.body,
        endpoint: 'POST /api/bookings'
      });

      // Handle specific error types
      if (error.message.includes('no longer available')) {
        return res.status(409).json({
          success: false,
          error: 'Room not available',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }

      if (error.message.includes('Invalid date') || 
          error.message.includes('Check-out date must be after') ||
          error.message.includes('Check-in date cannot be in the past')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date parameters',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }

      if (error.message.includes('Hotel not found')) {
        return res.status(404).json({
          success: false,
          error: 'Hotel not found',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }

      if (error.message.includes('Guests must be')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid guest count',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }

      // Generic server error
      res.status(500).json({
        success: false,
        error: 'Failed to create booking',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get booking by ID
   * GET /api/bookings/:id
   */
  async getBooking(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Booking ID is required',
          timestamp: new Date().toISOString()
        });
      }

      // Get booking with hotel and room information
      const booking = await bookingService.getBookingById(id);

      await logEvent('info', 'Booking retrieved via API', {
        booking_id: id,
        user_id: booking.user_id,
        endpoint: 'GET /api/bookings/:id'
      });

      res.status(200).json({
        success: true,
        data: booking,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      await logEvent('error', 'Get booking API failed', {
        error: error.message,
        booking_id: req.params.id,
        endpoint: 'GET /api/bookings/:id'
      });

      if (error.message.includes('Booking not found')) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }

      if (error.message.includes('Database service unavailable')) {
        return res.status(503).json({
          success: false,
          error: 'Service unavailable',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }

      // Generic server error
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve booking',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Export singleton instance
const bookingController = new BookingController();
export default bookingController;