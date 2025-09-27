import supabase from '../supabase.js';
import { logEvent } from '../services/logService.js';
import availabilityService from '../services/availability.service.js';
import databaseService from '../services/databaseService.js';

/**
 * Hotel Controller
 * Handles HTTP requests for hotel and room operations
 */
class HotelController {
  /**
   * List all hotels
   * GET /api/hotels
   * Query parameters:
   * - city: Filter by city key (optional)
   * - limit: Number of results (default: 50, max: 100)
   * - offset: Pagination offset (default: 0)
   */
  async listHotels(req, res) {
    try {
      const { city, limit = 50, offset = 0 } = req.query;
      const parsedLimit = Math.min(parseInt(limit, 10) || 50, 100);
      const parsedOffset = parseInt(offset, 10) || 0;

      // Check if database is available
      if (!supabase) {
        return res.status(503).json({
          success: false,
          error: 'Database service unavailable',
          message: 'Database connection not configured',
          timestamp: new Date().toISOString()
        });
      }

      let query = supabase
        .from('hotels')
        .select(`
          id,
          name,
          price_per_night,
          rating,
          description,
          images,
          coordinates,
          amenities,
          is_active,
          created_at,
          cities!inner(id, key, names)
        `)
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .range(parsedOffset, parsedOffset + parsedLimit - 1);

      // Filter by city if provided
      if (city) {
        query = query.eq('cities.key', city);
      }

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Process hotels for response
      const hotels = data.map(hotel => ({
        id: hotel.id,
        name: hotel.name,
        price_per_night: hotel.price_per_night,
        rating: hotel.rating,
        description: hotel.description,
        images: hotel.images || [],
        coordinates: hotel.coordinates,
        amenities: hotel.amenities || [],
        city: {
          id: hotel.cities.id,
          key: hotel.cities.key,
          name: hotel.cities.names
        },
        created_at: hotel.created_at
      }));

      await logEvent('info', 'Hotels listed', {
        count: hotels.length,
        city: city || 'all',
        limit: parsedLimit,
        offset: parsedOffset
      });

      res.status(200).json({
        success: true,
        data: hotels,
        pagination: {
          limit: parsedLimit,
          offset: parsedOffset,
          total: count
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      await logEvent('error', 'List hotels failed', {
        error: error.message,
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve hotels',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get a specific hotel by ID
   * GET /api/hotels/:id
   */
  async getHotel(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Hotel ID is required',
          timestamp: new Date().toISOString()
        });
      }

      // Check if database is available
      if (!supabase) {
        return res.status(503).json({
          success: false,
          error: 'Database service unavailable',
          message: 'Database connection not configured',
          timestamp: new Date().toISOString()
        });
      }

      const { data, error } = await supabase
        .from('hotels')
        .select(`
          id,
          name,
          price_per_night,
          rating,
          description,
          images,
          coordinates,
          amenities,
          is_active,
          created_at,
          updated_at,
          cities!inner(id, key, names)
        `)
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Hotel not found',
            timestamp: new Date().toISOString()
          });
        }
        throw new Error(`Database query failed: ${error.message}`);
      }

      const hotel = {
        id: data.id,
        name: data.name,
        price_per_night: data.price_per_night,
        rating: data.rating,
        description: data.description,
        images: data.images || [],
        coordinates: data.coordinates,
        amenities: data.amenities || [],
        city: {
          id: data.cities.id,
          key: data.cities.key,
          name: data.cities.names
        },
        created_at: data.created_at,
        updated_at: data.updated_at
      };

      await logEvent('info', 'Hotel retrieved', {
        hotel_id: id,
        hotel_name: hotel.name
      });

      res.status(200).json({
        success: true,
        data: hotel,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      await logEvent('error', 'Get hotel failed', {
        error: error.message,
        hotel_id: req.params.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve hotel',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * List rooms (hotels) by hotel ID with availability check
   * GET /api/hotels/:id/rooms?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD
   * In this system, each hotel is essentially a room, so this returns the hotel
   * with availability status if dates are provided
   */
  async listRoomsByHotel(req, res) {
    try {
      const { id } = req.params;
      const { checkin, checkout } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Hotel ID is required',
          timestamp: new Date().toISOString()
        });
      }

      // Check if database is available
      if (!supabase) {
        return res.status(503).json({
          success: false,
          error: 'Database service unavailable',
          message: 'Database connection not configured',
          timestamp: new Date().toISOString()
        });
      }

      // Get the hotel details first
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .select(`
          id,
          name,
          price_per_night,
          rating,
          description,
          images,
          coordinates,
          amenities,
          is_active,
          cities!inner(id, key, names)
        `)
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (hotelError) {
        if (hotelError.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Hotel not found',
            timestamp: new Date().toISOString()
          });
        }
        throw new Error(`Database query failed: ${hotelError.message}`);
      }

      // Prepare room data (in this system, the hotel is the room)
      const room = {
        id: hotel.id,
        name: hotel.name,
        price_per_night: hotel.price_per_night,
        rating: hotel.rating,
        description: hotel.description,
        images: hotel.images || [],
        coordinates: hotel.coordinates,
        amenities: hotel.amenities || [],
        city: {
          id: hotel.cities.id,
          key: hotel.cities.key,
          name: hotel.cities.names
        }
      };

      // Check availability if dates are provided
      if (checkin && checkout) {
        try {
          const isAvailable = await availabilityService.checkRoomAvailability(
            id,
            checkin,
            checkout
          );

          room.availability = {
            available: isAvailable,
            checkin,
            checkout,
            checked_at: new Date().toISOString()
          };

          // Only return available rooms if dates are specified
          if (!isAvailable) {
            await logEvent('info', 'Hotel rooms filtered by availability', {
              hotel_id: id,
              checkin,
              checkout,
              available_rooms: 0
            });

            return res.status(200).json({
              success: true,
              data: [],
              message: 'No available rooms for the specified dates',
              filters: { checkin, checkout },
              timestamp: new Date().toISOString()
            });
          }

        } catch (availabilityError) {
          console.error('Availability check failed:', availabilityError.message);
          // Continue without availability info if check fails
          room.availability = {
            available: null,
            error: 'Could not check availability',
            checked_at: new Date().toISOString()
          };
        }
      }

      await logEvent('info', 'Hotel rooms listed', {
        hotel_id: id,
        hotel_name: hotel.name,
        has_availability_check: !!(checkin && checkout),
        available: room.availability?.available
      });

      res.status(200).json({
        success: true,
        data: [room], // Return as array since this is a "rooms" endpoint
        filters: checkin && checkout ? { checkin, checkout } : null,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      await logEvent('error', 'List hotel rooms failed', {
        error: error.message,
        hotel_id: req.params.id,
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve hotel rooms',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Export singleton instance
const hotelController = new HotelController();
export default hotelController;