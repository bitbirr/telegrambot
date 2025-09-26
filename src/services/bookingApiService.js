// =====================================================
// eQabo.com Telegram Bot - Booking API Service
// Service for integrating the Telegram bot with the REST API
// =====================================================

import axios from 'axios';
import { logEvent } from './logService.js';

/**
 * Booking API Service
 * Provides a bridge between the Telegram bot and the REST API
 */
class BookingApiService {
  constructor() {
    this.baseURL = process.env.BOOKING_API_URL || 'http://localhost:3001';
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'eqabo-telegram-bot/1.0.0'
      }
    });

    // Add response interceptor for logging
    this.apiClient.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        logEvent('error', 'Booking API request failed', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message,
          context: 'booking_api_service'
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get all cities
   * @param {string} language - Language code
   * @returns {Promise<Array>} - Array of cities
   */
  async getCities(language = 'en') {
    try {
      const response = await this.apiClient.get('/api/cities', {
        params: { language }
      });

      await logEvent('info', 'Cities retrieved via API', {
        count: response.data.count,
        language,
        context: 'booking_api_service'
      });

      return response.data.data || [];
    } catch (error) {
      await logEvent('error', 'Failed to get cities from API', {
        error: error.message,
        language,
        context: 'booking_api_service'
      });
      return [];
    }
  }

  /**
   * Get hotels for a city
   * @param {string} cityId - City ID
   * @param {string} language - Language code
   * @returns {Promise<Array>} - Array of hotels
   */
  async getHotels(cityId, language = 'en') {
    try {
      const response = await this.apiClient.get('/api/hotels', {
        params: { city_id: cityId, language }
      });

      await logEvent('info', 'Hotels retrieved via API', {
        city_id: cityId,
        count: response.data.count,
        language,
        context: 'booking_api_service'
      });

      return response.data.data || [];
    } catch (error) {
      await logEvent('error', 'Failed to get hotels from API', {
        error: error.message,
        city_id: cityId,
        language,
        context: 'booking_api_service'
      });
      return [];
    }
  }

  /**
   * Check room availability
   * @param {string} hotelId - Hotel ID
   * @param {string} checkin - Check-in date (YYYY-MM-DD)
   * @param {string} checkout - Check-out date (YYYY-MM-DD)
   * @returns {Promise<Object>} - Room availability data
   */
  async checkRoomAvailability(hotelId, checkin, checkout) {
    try {
      const response = await this.apiClient.get('/api/rooms', {
        params: { hotel_id: hotelId, checkin, checkout }
      });

      await logEvent('info', 'Room availability checked via API', {
        hotel_id: hotelId,
        checkin,
        checkout,
        available_rooms: response.data.data?.summary?.available || 0,
        context: 'booking_api_service'
      });

      return response.data.data;
    } catch (error) {
      await logEvent('error', 'Failed to check room availability via API', {
        error: error.message,
        hotel_id: hotelId,
        checkin,
        checkout,
        context: 'booking_api_service'
      });
      return null;
    }
  }

  /**
   * Create a booking
   * @param {Object} bookingData - Booking information
   * @returns {Promise<Object>} - Created booking data
   */
  async createBooking(bookingData) {
    try {
      const response = await this.apiClient.post('/api/bookings', bookingData);

      await logEvent('info', 'Booking created via API', {
        booking_id: response.data.data?.booking_id,
        booking_reference: response.data.data?.booking_reference,
        user_id: bookingData.user_id,
        hotel_id: bookingData.hotel_id,
        context: 'booking_api_service'
      });

      return response.data.data;
    } catch (error) {
      await logEvent('error', 'Failed to create booking via API', {
        error: error.message,
        user_id: bookingData.user_id,
        hotel_id: bookingData.hotel_id,
        context: 'booking_api_service'
      });
      throw error;
    }
  }

  /**
   * Initiate payment
   * @param {Object} paymentData - Payment initiation data
   * @returns {Promise<Object>} - Payment initiation response
   */
  async initiatePayment(paymentData) {
    try {
      const response = await this.apiClient.post('/api/payments/initiate', paymentData);

      await logEvent('info', 'Payment initiated via API', {
        booking_id: paymentData.booking_id,
        payment_reference: response.data.data?.payment_reference,
        amount: response.data.data?.amount,
        context: 'booking_api_service'
      });

      return response.data.data;
    } catch (error) {
      await logEvent('error', 'Failed to initiate payment via API', {
        error: error.message,
        booking_id: paymentData.booking_id,
        context: 'booking_api_service'
      });
      throw error;
    }
  }

  /**
   * Handle payment callback (typically called by payment provider)
   * @param {Object} callbackData - Payment callback data
   * @returns {Promise<Object>} - Callback processing result
   */
  async handlePaymentCallback(callbackData) {
    try {
      const response = await this.apiClient.post('/api/payments/callback', callbackData);

      await logEvent('info', 'Payment callback processed via API', {
        booking_id: response.data.data?.booking_id,
        status: response.data.data?.status,
        context: 'booking_api_service'
      });

      return response.data.data;
    } catch (error) {
      await logEvent('error', 'Failed to process payment callback via API', {
        error: error.message,
        callback_data: callbackData,
        context: 'booking_api_service'
      });
      throw error;
    }
  }

  /**
   * Generate receipt PDF
   * @param {string} bookingId - Booking ID
   * @returns {Promise<string>} - URL or path to PDF receipt
   */
  async generateReceipt(bookingId) {
    try {
      const response = await this.apiClient.get(`/api/receipts/${bookingId}`, {
        responseType: 'stream' // For file download
      });

      await logEvent('info', 'Receipt generated via API', {
        booking_id: bookingId,
        context: 'booking_api_service'
      });

      return response;
    } catch (error) {
      await logEvent('error', 'Failed to generate receipt via API', {
        error: error.message,
        booking_id: bookingId,
        context: 'booking_api_service'
      });
      throw error;
    }
  }

  /**
   * Get booking status
   * This is a helper method that would call a booking details endpoint
   * @param {string} bookingId - Booking ID
   * @returns {Promise<Object>} - Booking details
   */
  async getBookingStatus(bookingId) {
    try {
      // This would be implemented when we have a booking details endpoint
      const response = await this.apiClient.get(`/api/bookings/${bookingId}`);
      
      await logEvent('info', 'Booking status retrieved via API', {
        booking_id: bookingId,
        status: response.data.data?.status,
        context: 'booking_api_service'
      });

      return response.data.data;
    } catch (error) {
      await logEvent('error', 'Failed to get booking status via API', {
        error: error.message,
        booking_id: bookingId,
        context: 'booking_api_service'
      });
      return null;
    }
  }

  /**
   * Check API health
   * @returns {Promise<boolean>} - Whether API is healthy
   */
  async checkApiHealth() {
    try {
      const response = await this.apiClient.get('/api/health');
      return response.data.status === 'healthy';
    } catch (error) {
      await logEvent('error', 'API health check failed', {
        error: error.message,
        context: 'booking_api_service'
      });
      return false;
    }
  }

  /**
   * Format booking data for API
   * Converts Telegram bot session data to API format
   * @param {Object} session - User session data
   * @param {Object} userDetails - Additional user details
   * @returns {Object} - Formatted booking data
   */
  formatBookingData(session, userDetails = {}) {
    const bookingData = {
      user_id: session.userId || userDetails.user_id,
      room_id: session.selectedRoom?.id,
      hotel_id: session.selectedHotel?.id,
      check_in_date: session.checkInDate,
      check_out_date: session.checkOutDate,
      guests: session.guests,
      payment_method_id: session.paymentMethodId,
      special_requests: session.specialRequests || '',
      user_details: {
        username: userDetails.username,
        first_name: userDetails.first_name,
        last_name: userDetails.last_name,
        email: session.email,
        language: session.language
      }
    };

    return bookingData;
  }

  /**
   * Format payment initiation data
   * @param {string} bookingId - Booking ID
   * @param {string} paymentMethod - Payment method
   * @param {string} phoneNumber - User's phone number
   * @returns {Object} - Formatted payment data
   */
  formatPaymentData(bookingId, paymentMethod, phoneNumber = null) {
    return {
      booking_id: bookingId,
      payment_method: paymentMethod,
      phone_number: phoneNumber,
      return_url: process.env.PAYMENT_RETURN_URL || 'https://eqabo.com/booking-success'
    };
  }

  /**
   * Parse room availability for Telegram bot display
   * @param {Object} availabilityData - Room availability data from API
   * @returns {Object} - Parsed data for bot display
   */
  parseRoomAvailability(availabilityData) {
    if (!availabilityData) {
      return {
        availableRooms: [],
        reservedRooms: [],
        summary: { total_rooms: 0, available: 0, reserved: 0 }
      };
    }

    return {
      availableRooms: availabilityData.available_rooms || [],
      reservedRooms: availabilityData.reserved_rooms || [],
      summary: availabilityData.summary || { total_rooms: 0, available: 0, reserved: 0 }
    };
  }

  /**
   * Create inline keyboard for room selection
   * @param {Array} availableRooms - Available rooms
   * @param {string} prefix - Callback data prefix
   * @returns {Object} - Telegram inline keyboard
   */
  createRoomSelectionKeyboard(availableRooms, prefix = 'room_') {
    const keyboard = {
      inline_keyboard: []
    };

    // Group rooms by type for better display
    const roomsByType = {};
    availableRooms.forEach(room => {
      if (!roomsByType[room.room_type]) {
        roomsByType[room.room_type] = [];
      }
      roomsByType[room.room_type].push(room);
    });

    // Create keyboard buttons
    Object.keys(roomsByType).forEach(roomType => {
      const rooms = roomsByType[roomType];
      
      // Add room type header (disabled button)
      keyboard.inline_keyboard.push([{
        text: `${roomType.toUpperCase()} ROOMS`,
        callback_data: 'noop'
      }]);

      // Add room buttons (2 per row)
      for (let i = 0; i < rooms.length; i += 2) {
        const row = [];
        
        // First room
        const room1 = rooms[i];
        row.push({
          text: `${room1.room_number || roomType} - ${room1.price_per_night} ETB`,
          callback_data: `${prefix}${room1.id}`
        });

        // Second room (if exists)
        if (i + 1 < rooms.length) {
          const room2 = rooms[i + 1];
          row.push({
            text: `${room2.room_number || roomType} - ${room2.price_per_night} ETB`,
            callback_data: `${prefix}${room2.id}`
          });
        }

        keyboard.inline_keyboard.push(row);
      }
    });

    return keyboard;
  }
}

// Create singleton instance
const bookingApiService = new BookingApiService();

export default bookingApiService;