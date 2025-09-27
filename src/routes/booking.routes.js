import express from 'express';
import bookingController from '../controllers/booking.controller.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     BookingRequest:
 *       type: object
 *       required:
 *         - hotelId
 *         - roomId
 *         - checkin
 *         - checkout
 *         - guests
 *       properties:
 *         hotelId:
 *           type: string
 *           format: uuid
 *           description: Hotel ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         roomId:
 *           type: string
 *           format: uuid
 *           description: Room ID (same as hotelId in this system)
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         checkin:
 *           type: string
 *           format: date
 *           description: Check-in date (YYYY-MM-DD)
 *           example: "2024-01-15"
 *         checkout:
 *           type: string
 *           format: date
 *           description: Check-out date (YYYY-MM-DD)
 *           example: "2024-01-18"
 *         guests:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           description: Number of guests
 *           example: 2
 *         userId:
 *           type: integer
 *           description: User ID (optional, defaults to test user)
 *           example: 123456789
 *         userDetails:
 *           type: object
 *           description: Additional user information (optional)
 *           properties:
 *             name:
 *               type: string
 *               example: "John Doe"
 *             email:
 *               type: string
 *               format: email
 *               example: "john@example.com"
 *             phone:
 *               type: string
 *               example: "+251911234567"
 *     BookingResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Booking ID
 *         booking_reference:
 *           type: string
 *           description: Unique booking reference
 *           example: "BK1234567890AB"
 *         hotel_id:
 *           type: string
 *           format: uuid
 *           description: Hotel ID
 *         hotel_name:
 *           type: string
 *           description: Hotel name
 *         check_in_date:
 *           type: string
 *           format: date
 *           description: Check-in date
 *         check_out_date:
 *           type: string
 *           format: date
 *           description: Check-out date
 *         guests:
 *           type: integer
 *           description: Number of guests
 *         nights:
 *           type: integer
 *           description: Number of nights
 *         price_per_night:
 *           type: integer
 *           description: Price per night in Ethiopian Birr
 *         amount:
 *           type: integer
 *           description: Total amount for payment processing
 *         total_amount:
 *           type: integer
 *           description: Total booking amount in Ethiopian Birr
 *         status:
 *           type: string
 *           enum: [pending_payment, confirmed, cancelled]
 *           description: Booking status
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Booking creation timestamp
 *     BookingDetails:
 *       allOf:
 *         - $ref: '#/components/schemas/BookingResponse'
 *         - type: object
 *           properties:
 *             user_id:
 *               type: integer
 *               description: User ID
 *             payment_method:
 *               type: string
 *               nullable: true
 *               description: Payment method used
 *             special_requests:
 *               type: string
 *               nullable: true
 *               description: Special requests from guest
 *             user_details:
 *               type: object
 *               description: User details
 *             updated_at:
 *               type: string
 *               format: date-time
 *               description: Last update timestamp
 *             hotel:
 *               $ref: '#/components/schemas/Hotel'
 *             room:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                 price_per_night:
 *                   type: integer
 *                 rating:
 *                   type: integer
 *     BookingApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           oneOf:
 *             - $ref: '#/components/schemas/BookingResponse'
 *             - $ref: '#/components/schemas/BookingDetails'
 *         timestamp:
 *           type: string
 *           format: date-time
 *     BookingErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *         message:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Create a new booking
 *     description: Create a hotel booking with concurrency safety using advisory locks
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookingRequest'
 *           examples:
 *             basic_booking:
 *               summary: Basic booking example
 *               value:
 *                 hotelId: "550e8400-e29b-41d4-a716-446655440000"
 *                 roomId: "550e8400-e29b-41d4-a716-446655440000"
 *                 checkin: "2024-01-15"
 *                 checkout: "2024-01-18"
 *                 guests: 2
 *             with_user_details:
 *               summary: Booking with user details
 *               value:
 *                 hotelId: "550e8400-e29b-41d4-a716-446655440000"
 *                 roomId: "550e8400-e29b-41d4-a716-446655440000"
 *                 checkin: "2024-01-15"
 *                 checkout: "2024-01-18"
 *                 guests: 2
 *                 userId: 123456789
 *                 userDetails:
 *                   name: "John Doe"
 *                   email: "john@example.com"
 *                   phone: "+251911234567"
 *     responses:
 *       201:
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingApiResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 booking_reference: "BK1234567890AB"
 *                 hotel_id: "550e8400-e29b-41d4-a716-446655440000"
 *                 hotel_name: "Grand Palace Hotel"
 *                 check_in_date: "2024-01-15"
 *                 check_out_date: "2024-01-18"
 *                 guests: 2
 *                 nights: 3
 *                 price_per_night: 2500
 *                 amount: 7500
 *                 total_amount: 7500
 *                 status: "pending_payment"
 *                 created_at: "2024-01-10T10:30:00Z"
 *               timestamp: "2024-01-10T10:30:00Z"
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingErrorResponse'
 *             examples:
 *               missing_fields:
 *                 summary: Missing required fields
 *                 value:
 *                   success: false
 *                   error: "Missing required fields"
 *                   message: "hotelId, roomId, checkin, checkout, and guests are required"
 *                   timestamp: "2024-01-10T10:30:00Z"
 *               invalid_dates:
 *                 summary: Invalid date parameters
 *                 value:
 *                   success: false
 *                   error: "Invalid date parameters"
 *                   message: "Check-out date must be after check-in date"
 *                   timestamp: "2024-01-10T10:30:00Z"
 *       404:
 *         description: Hotel not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingErrorResponse'
 *       409:
 *         description: Room not available for selected dates
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingErrorResponse'
 *             example:
 *               success: false
 *               error: "Room not available"
 *               message: "Room is no longer available for the selected dates"
 *               timestamp: "2024-01-10T10:30:00Z"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingErrorResponse'
 */
router.post('/', bookingController.createBooking.bind(bookingController));

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Get booking by ID
 *     description: Retrieve detailed booking information including hotel and room details
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Booking details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/BookingApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/BookingDetails'
 *             example:
 *               success: true
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 booking_reference: "BK1234567890AB"
 *                 user_id: 123456789
 *                 status: "pending_payment"
 *                 check_in_date: "2024-01-15"
 *                 check_out_date: "2024-01-18"
 *                 guests: 2
 *                 nights: 3
 *                 total_amount: 7500
 *                 payment_method: null
 *                 special_requests: null
 *                 user_details:
 *                   name: "John Doe"
 *                   email: "john@example.com"
 *                 created_at: "2024-01-10T10:30:00Z"
 *                 updated_at: "2024-01-10T10:30:00Z"
 *                 hotel:
 *                   id: "550e8400-e29b-41d4-a716-446655440000"
 *                   name: "Grand Palace Hotel"
 *                   price_per_night: 2500
 *                   rating: 5
 *                   description:
 *                     en: "Luxury hotel in the heart of the city"
 *                   images: ["https://example.com/image1.jpg"]
 *                   coordinates:
 *                     latitude: 9.0320
 *                     longitude: 38.7468
 *                   amenities: ["WiFi", "Pool", "Gym"]
 *                   city:
 *                     id: "city-uuid"
 *                     key: "addis_ababa"
 *                     name:
 *                       en: "Addis Ababa"
 *                       am: "አዲስ አበባ"
 *                 room:
 *                   id: "550e8400-e29b-41d4-a716-446655440000"
 *                   name: "Grand Palace Hotel"
 *                   price_per_night: 2500
 *                   rating: 5
 *               timestamp: "2024-01-10T10:30:00Z"
 *       400:
 *         description: Invalid booking ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingErrorResponse'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingErrorResponse'
 *             example:
 *               success: false
 *               error: "Booking not found"
 *               message: "Booking not found"
 *               timestamp: "2024-01-10T10:30:00Z"
 *       503:
 *         description: Service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingErrorResponse'
 */
router.get('/:id', bookingController.getBooking.bind(bookingController));

export default router;