import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import supabase from '../supabase.js';
import { logEvent } from '../services/logService.js';
import pdfReceiptService from '../services/pdfReceiptService.js';

// Create winston logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/api.log' })
  ]
});

const app = express();
const PORT = process.env.API_PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://eqabo.com'],
  credentials: true
}));
app.use(compression());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.'
  }
});

const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit payment requests
  message: {
    error: 'Too many payment requests',
    message: 'Payment rate limit exceeded. Please wait before trying again.'
  }
});

app.use('/api/', apiLimiter);
app.use('/api/payments', paymentLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    logger.info({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
    originalSend.call(this, data);
  };
  
  next();
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if database is available and return appropriate error response
 */
function checkDatabaseAvailability(res) {
  if (!supabase) {
    res.status(503).json({
      success: false,
      error: 'Database unavailable',
      message: 'Database connection is not configured. Please check your Supabase credentials.'
    });
    return false;
  }
  return true;
}

// =====================================================
// API ENDPOINTS
// =====================================================

/**
 * GET /api/cities
 * List all destination cities
 */
app.get('/api/cities', async (req, res) => {
  try {
    if (!checkDatabaseAvailability(res)) return;
    
    const { language = 'en' } = req.query;

    const { data: cities, error } = await supabase
      .from('cities')
      .select('*')
      .eq('is_active', true)
      .order('names->en');

    if (error) {
      throw error;
    }

    // Format response with localized names
    const formattedCities = cities.map(city => ({
      id: city.id,
      key: city.key,
      name: city.names[language] || city.names.en,
      names: city.names,
      coordinates: city.coordinates
    }));

    await logEvent('info', 'Cities API accessed', {
      endpoint: '/api/cities',
      language,
      count: formattedCities.length,
      ip: req.ip
    });

    res.json({
      success: true,
      data: formattedCities,
      count: formattedCities.length
    });

  } catch (error) {
    await logEvent('error', 'Cities API error', {
      endpoint: '/api/cities',
      error: error.message,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cities',
      message: error.message
    });
  }
});

/**
 * GET /api/hotels?city_id=xxx
 * List hotels for a given city
 */
app.get('/api/hotels', async (req, res) => {
  try {
    if (!checkDatabaseAvailability(res)) return;
    
    const { city_id, language = 'en' } = req.query;

    if (!city_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'city_id parameter is required'
      });
    }

    const { data: hotels, error } = await supabase
      .from('hotels')
      .select(`
        *,
        cities!inner(id, key, names)
      `)
      .eq('cities.id', city_id)
      .eq('is_active', true)
      .order('rating', { ascending: false });

    if (error) {
      throw error;
    }

    // Format response with localized descriptions
    const formattedHotels = hotels.map(hotel => ({
      id: hotel.id,
      name: hotel.name,
      description: hotel.description[language] || hotel.description.en,
      price_per_night: hotel.price_per_night,
      rating: hotel.rating,
      amenities: hotel.amenities,
      images: hotel.images,
      coordinates: hotel.coordinates,
      city: {
        id: hotel.cities.id,
        key: hotel.cities.key,
        name: hotel.cities.names[language] || hotel.cities.names.en
      }
    }));

    await logEvent('info', 'Hotels API accessed', {
      endpoint: '/api/hotels',
      city_id,
      language,
      count: formattedHotels.length,
      ip: req.ip
    });

    res.json({
      success: true,
      data: formattedHotels,
      count: formattedHotels.length
    });

  } catch (error) {
    await logEvent('error', 'Hotels API error', {
      endpoint: '/api/hotels',
      city_id: req.query.city_id,
      error: error.message,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve hotels',
      message: error.message
    });
  }
});

/**
 * GET /api/rooms?hotel_id=xxx&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD
 * Check room availability
 */
app.get('/api/rooms', async (req, res) => {
  try {
    const { hotel_id, checkin, checkout } = req.query;

    // Validate required parameters
    if (!hotel_id || !checkin || !checkout) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'hotel_id, checkin, and checkout parameters are required'
      });
    }

    // Validate date format
    const checkinDate = new Date(checkin);
    const checkoutDate = new Date(checkout);
    
    if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
        message: 'Dates must be in YYYY-MM-DD format'
      });
    }

    if (checkinDate >= checkoutDate) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date range',
        message: 'Check-out date must be after check-in date'
      });
    }

    // Get all rooms for the hotel
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select(`
        *,
        hotels!inner(id, name, city_id)
      `)
      .eq('hotels.id', hotel_id)
      .eq('is_available', true);

    if (roomsError) {
      throw roomsError;
    }

    // Check availability for each room
    const roomAvailability = await Promise.all(
      rooms.map(async (room) => {
        const { data: availability } = await supabase
          .rpc('check_room_availability', {
            p_room_id: room.id,
            p_check_in: checkin,
            p_check_out: checkout
          });

        return {
          id: room.id,
          room_type: room.room_type,
          room_number: room.room_number,
          capacity: room.capacity,
          price_per_night: room.price_per_night,
          amenities: room.amenities,
          images: room.images,
          available: availability === true,
          hotel: {
            id: room.hotels.id,
            name: room.hotels.name
          }
        };
      })
    );

    const availableRooms = roomAvailability.filter(room => room.available);
    const reservedRooms = roomAvailability.filter(room => !room.available);

    await logEvent('info', 'Rooms availability API accessed', {
      endpoint: '/api/rooms',
      hotel_id,
      checkin,
      checkout,
      total_rooms: roomAvailability.length,
      available_rooms: availableRooms.length,
      reserved_rooms: reservedRooms.length,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        hotel_id,
        checkin,
        checkout,
        available_rooms: availableRooms,
        reserved_rooms: reservedRooms.map(room => ({
          id: room.id,
          room_type: room.room_type,
          room_number: room.room_number
        })),
        summary: {
          total_rooms: roomAvailability.length,
          available: availableRooms.length,
          reserved: reservedRooms.length
        }
      }
    });

  } catch (error) {
    await logEvent('error', 'Rooms API error', {
      endpoint: '/api/rooms',
      hotel_id: req.query.hotel_id,
      error: error.message,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to check room availability',
      message: error.message
    });
  }
});

/**
 * POST /api/bookings
 * Create booking (status: pending_payment)
 */
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      user_id,
      room_id,
      hotel_id,
      check_in_date,
      check_out_date,
      guests,
      payment_method_id,
      special_requests,
      user_details = {}
    } = req.body;

    // Validate required fields
    if (!user_id || !room_id || !hotel_id || !check_in_date || !check_out_date || !guests) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'user_id, room_id, hotel_id, check_in_date, check_out_date, and guests are required'
      });
    }

    // Check room availability
    const { data: isAvailable } = await supabase
      .rpc('check_room_availability', {
        p_room_id: room_id,
        p_check_in: check_in_date,
        p_check_out: check_out_date
      });

    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        error: 'Room not available',
        message: 'Selected room is not available for the chosen dates'
      });
    }

    // Get room and hotel details for pricing
    const { data: roomDetails, error: roomError } = await supabase
      .from('rooms')
      .select(`
        *,
        hotels(*)
      `)
      .eq('id', room_id)
      .single();

    if (roomError || !roomDetails) {
      return res.status(404).json({
        success: false,
        error: 'Room not found',
        message: 'The specified room could not be found'
      });
    }

    // Calculate total amount
    const checkinDate = new Date(check_in_date);
    const checkoutDate = new Date(check_out_date);
    const nights = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
    const totalAmount = nights * roomDetails.price_per_night;

    // Create booking with transaction
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        user_id,
        hotel_id,
        room_id,
        check_in_date,
        check_out_date,
        guests,
        payment_method_id,
        total_amount: totalAmount,
        status: 'pending_payment',
        payment_status: 'pending',
        special_requests,
        ...user_details
      })
      .select()
      .single();

    if (bookingError) {
      throw bookingError;
    }

    // Create room booking record
    await supabase
      .from('room_bookings')
      .insert({
        room_id,
        booking_id: booking.id,
        check_in_date,
        check_out_date,
        status: 'active'
      });

    await logEvent('info', 'Booking created', {
      endpoint: '/api/bookings',
      booking_id: booking.id,
      booking_reference: booking.booking_reference,
      user_id,
      hotel_id,
      room_id,
      total_amount: totalAmount,
      nights,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: {
        booking_id: booking.id,
        booking_reference: booking.booking_reference,
        status: booking.status,
        payment_status: booking.payment_status,
        total_amount: totalAmount,
        nights,
        check_in_date,
        check_out_date,
        room: {
          id: roomDetails.id,
          type: roomDetails.room_type,
          number: roomDetails.room_number
        },
        hotel: {
          id: roomDetails.hotels.id,
          name: roomDetails.hotels.name
        }
      },
      message: 'Booking created successfully. Please proceed to payment.'
    });

  } catch (error) {
    await logEvent('error', 'Booking creation error', {
      endpoint: '/api/bookings',
      error: error.message,
      user_id: req.body.user_id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create booking',
      message: error.message
    });
  }
});

/**
 * POST /api/payments/initiate
 * Start push payment with provider
 */
app.post('/api/payments/initiate', async (req, res) => {
  try {
    const {
      booking_id,
      payment_method,
      phone_number,
      return_url
    } = req.body;

    if (!booking_id || !payment_method) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'booking_id and payment_method are required'
      });
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        hotels(name),
        rooms(room_type, room_number)
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
        message: 'The specified booking could not be found'
      });
    }

    if (booking.payment_status === 'success') {
      return res.status(400).json({
        success: false,
        error: 'Payment already completed',
        message: 'This booking has already been paid for'
      });
    }

    // For now, we'll simulate payment initiation
    // In production, you would integrate with actual payment providers
    const providerTransactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const paymentReference = `PAY_${booking.booking_reference}_${Date.now()}`;
    
    // Mock payment URL - in production this would come from payment provider
    const paymentUrl = `https://payment.provider.com/pay?ref=${paymentReference}&amount=${booking.total_amount}`;

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        booking_id,
        amount: booking.total_amount,
        status: 'pending',
        provider_transaction_id: providerTransactionId,
        provider_reference: paymentReference,
        payment_url: paymentUrl,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
      })
      .select()
      .single();

    if (paymentError) {
      throw paymentError;
    }

    // Update booking payment status
    await supabase
      .from('bookings')
      .update({
        payment_status: 'processing',
        status: 'pending_payment'
      })
      .eq('id', booking_id);

    await logEvent('info', 'Payment initiated', {
      endpoint: '/api/payments/initiate',
      booking_id,
      payment_id: payment.id,
      payment_reference: paymentReference,
      provider_transaction_id: providerTransactionId,
      amount: booking.total_amount,
      payment_method,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        payment_id: payment.id,
        payment_reference: paymentReference,
        provider_transaction_id: providerTransactionId,
        payment_url: paymentUrl,
        amount: booking.total_amount,
        currency: 'ETB',
        expires_at: payment.expires_at,
        booking_reference: booking.booking_reference
      },
      message: 'Payment initiated successfully'
    });

  } catch (error) {
    await logEvent('error', 'Payment initiation error', {
      endpoint: '/api/payments/initiate',
      booking_id: req.body.booking_id,
      error: error.message,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to initiate payment',
      message: error.message
    });
  }
});

/**
 * POST /api/payments/callback
 * Handle payment confirmation/failure
 */
app.post('/api/payments/callback', async (req, res) => {
  try {
    const {
      provider_transaction_id,
      provider_reference,
      status,
      amount,
      callback_data = {}
    } = req.body;

    if (!provider_transaction_id && !provider_reference) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment reference',
        message: 'Either provider_transaction_id or provider_reference is required'
      });
    }

    // Find payment record
    let query = supabase.from('payments').select('*');
    
    if (provider_transaction_id) {
      query = query.eq('provider_transaction_id', provider_transaction_id);
    } else {
      query = query.eq('provider_reference', provider_reference);
    }

    const { data: payment, error: paymentError } = await query.single();

    if (paymentError || !payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
        message: 'Payment record not found for the provided reference'
      });
    }

    // Update payment status
    const updateData = {
      status: status === 'success' ? 'success' : 'failed',
      callback_data,
      completed_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', payment.id);

    if (updateError) {
      throw updateError;
    }

    // Update booking status based on payment result
    const bookingStatus = status === 'success' ? 'confirmed' : 'cancelled';
    const paymentStatus = status === 'success' ? 'success' : 'failed';

    await supabase
      .from('bookings')
      .update({
        status: bookingStatus,
        payment_status: paymentStatus
      })
      .eq('id', payment.booking_id);

    // If payment failed, release the room booking
    if (status !== 'success') {
      await supabase
        .from('room_bookings')
        .update({ status: 'cancelled' })
        .eq('booking_id', payment.booking_id);
    }

    await logEvent('info', 'Payment callback processed', {
      endpoint: '/api/payments/callback',
      payment_id: payment.id,
      booking_id: payment.booking_id,
      status,
      amount,
      provider_transaction_id,
      provider_reference,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        payment_id: payment.id,
        booking_id: payment.booking_id,
        status: updateData.status,
        booking_status: bookingStatus
      },
      message: `Payment ${status === 'success' ? 'completed successfully' : 'failed'}`
    });

  } catch (error) {
    await logEvent('error', 'Payment callback error', {
      endpoint: '/api/payments/callback',
      error: error.message,
      callback_data: req.body,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to process payment callback',
      message: error.message
    });
  }
});

/**
 * GET /api/receipts/:booking_id
 * Generate and return PDF receipt
 */
app.get('/api/receipts/:booking_id', async (req, res) => {
  try {
    const { booking_id } = req.params;
    const { download = 'false' } = req.query;

    // Get booking details with all related information
    const { data: booking, error: bookingError } = await supabase
      .from('booking_details')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
        message: 'The specified booking could not be found'
      });
    }

    if (booking.payment_status !== 'success') {
      return res.status(400).json({
        success: false,
        error: 'Booking not paid',
        message: 'Receipt can only be generated for paid bookings'
      });
    }

    // Prepare receipt data
    const receiptData = {
      id: booking.id,
      booking_reference: booking.booking_reference,
      user_id: booking.user_id,
      guest_name: booking.first_name || booking.username || 'Guest',
      guest_email: booking.email || '',
      hotel_id: booking.hotel_id,
      hotel_name: booking.hotel_name,
      city: booking.city_key,
      check_in_date: booking.check_in_date,
      check_out_date: booking.check_out_date,
      guests: booking.guests,
      room_type: booking.room_type,
      room_number: booking.room_number,
      total_price: booking.total_amount,
      payment_method: booking.payment_method_name,
      payment_reference: booking.payment_reference,
      created_at: booking.created_at,
      language: 'en' // Could be dynamic based on user preference
    };

    // Generate PDF receipt
    const pdfPath = await pdfReceiptService.generateBookingReceipt(receiptData, receiptData.language);

    await logEvent('info', 'Receipt generated', {
      endpoint: '/api/receipts/:booking_id',
      booking_id,
      booking_reference: booking.booking_reference,
      pdf_path: pdfPath,
      ip: req.ip
    });

    // Send file response
    const filename = `receipt_${booking.booking_reference}.pdf`;
    
    if (download === 'true') {
      res.download(pdfPath, filename);
    } else {
      res.sendFile(pdfPath, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`
        }
      });
    }

  } catch (error) {
    await logEvent('error', 'Receipt generation error', {
      endpoint: '/api/receipts/:booking_id',
      booking_id: req.params.booking_id,
      error: error.message,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate receipt',
      message: error.message
    });
  }
});

// =====================================================
// HEALTH CHECK AND STATUS ENDPOINTS
// =====================================================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', async (req, res) => {
  try {
    let dbStatus = 'unavailable';
    
    // Test database connection if supabase is available
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('cities')
          .select('count')
          .limit(1);

        dbStatus = error ? 'unhealthy' : 'healthy';
      } catch (dbError) {
        dbStatus = 'unhealthy';
      }
    }

    const overallStatus = dbStatus === 'healthy' ? 'healthy' : 'degraded';
    const statusCode = overallStatus === 'healthy' ? 200 : (dbStatus === 'unavailable' ? 200 : 503);

    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        api: 'healthy'
      }
    });

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * GET /api/status
 * API status and statistics
 */
app.get('/api/status', async (req, res) => {
  try {
    let statistics = {
      active_cities: 0,
      active_hotels: 0,
      total_bookings: 0
    };

    // Only get statistics if supabase is available
    if (supabase) {
      try {
        const [citiesResult, hotelsResult, bookingsResult] = await Promise.all([
          supabase.from('cities').select('count').eq('is_active', true),
          supabase.from('hotels').select('count').eq('is_active', true),
          supabase.from('bookings').select('count')
        ]);

        statistics = {
          active_cities: citiesResult.count || 0,
          active_hotels: hotelsResult.count || 0,
          total_bookings: bookingsResult.count || 0
        };
      } catch (dbError) {
        logger.warn('Database statistics unavailable:', dbError.message);
      }
    }

    res.json({
      status: supabase ? 'operational' : 'limited (no database)',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database_connected: !!supabase,
      statistics,
      endpoints: {
        '/api/cities': 'GET - List all destination cities',
        '/api/hotels': 'GET - List hotels for a city',
        '/api/rooms': 'GET - Check room availability',
        '/api/bookings': 'POST - Create booking',
        '/api/payments/initiate': 'POST - Initiate payment',
        '/api/payments/callback': 'POST - Payment callback',
        '/api/receipts/:booking_id': 'GET - Generate receipt PDF'
      }
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// =====================================================
// ERROR HANDLING MIDDLEWARE
// =====================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `${req.method} ${req.path} is not a valid API endpoint`
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error({
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(error.status || 500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// =====================================================
// SERVER STARTUP
// =====================================================

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Booking API server running on port ${PORT}`);
  logger.info(`📋 API Documentation available at http://localhost:${PORT}/api/status`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

export default app;