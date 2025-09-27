import express from 'express';
import hotelController from '../controllers/hotel.controller.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Hotel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique hotel identifier
 *         name:
 *           type: string
 *           description: Hotel name
 *         price_per_night:
 *           type: integer
 *           description: Price per night in Ethiopian Birr
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: Hotel rating (1-5 stars)
 *         description:
 *           type: object
 *           description: Multi-language hotel descriptions
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of image URLs
 *         coordinates:
 *           type: object
 *           properties:
 *             latitude:
 *               type: number
 *             longitude:
 *               type: number
 *         amenities:
 *           type: array
 *           items:
 *             type: string
 *           description: Hotel amenities
 *         city:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             key:
 *               type: string
 *             name:
 *               type: object
 *               description: Multi-language city names
 *         created_at:
 *           type: string
 *           format: date-time
 *     Room:
 *       allOf:
 *         - $ref: '#/components/schemas/Hotel'
 *         - type: object
 *           properties:
 *             availability:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                 checkin:
 *                   type: string
 *                   format: date
 *                 checkout:
 *                   type: string
 *                   format: date
 *                 checked_at:
 *                   type: string
 *                   format: date-time
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           oneOf:
 *             - $ref: '#/components/schemas/Hotel'
 *             - type: array
 *               items:
 *                 $ref: '#/components/schemas/Hotel'
 *         pagination:
 *           type: object
 *           properties:
 *             limit:
 *               type: integer
 *             offset:
 *               type: integer
 *             total:
 *               type: integer
 *         timestamp:
 *           type: string
 *           format: date-time
 *     ErrorResponse:
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
 * /api/hotels:
 *   get:
 *     summary: List all hotels
 *     description: Retrieve a list of hotels with optional filtering and pagination
 *     tags: [Hotels]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter hotels by city key (e.g., 'addis_ababa')
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of hotels to return (max 100)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of hotels to skip for pagination
 *     responses:
 *       200:
 *         description: List of hotels retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Hotel'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', hotelController.listHotels.bind(hotelController));

/**
 * @swagger
 * /api/hotels/{id}:
 *   get:
 *     summary: Get hotel by ID
 *     description: Retrieve detailed information about a specific hotel
 *     tags: [Hotels]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Hotel ID
 *     responses:
 *       200:
 *         description: Hotel details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Hotel'
 *       400:
 *         description: Invalid hotel ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Hotel not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', hotelController.getHotel.bind(hotelController));

/**
 * @swagger
 * /api/hotels/{id}/rooms:
 *   get:
 *     summary: List available rooms for a hotel
 *     description: Get hotel rooms with optional availability filtering for specific dates
 *     tags: [Hotels, Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Hotel ID
 *       - in: query
 *         name: checkin
 *         schema:
 *           type: string
 *           format: date
 *           example: '2024-01-15'
 *         description: Check-in date (YYYY-MM-DD) - required with checkout for availability filtering
 *       - in: query
 *         name: checkout
 *         schema:
 *           type: string
 *           format: date
 *           example: '2024-01-18'
 *         description: Check-out date (YYYY-MM-DD) - required with checkin for availability filtering
 *     responses:
 *       200:
 *         description: Hotel rooms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Room'
 *                     filters:
 *                       type: object
 *                       properties:
 *                         checkin:
 *                           type: string
 *                           format: date
 *                         checkout:
 *                           type: string
 *                           format: date
 *                       nullable: true
 *       400:
 *         description: Invalid hotel ID or date parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Hotel not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id/rooms', hotelController.listRoomsByHotel.bind(hotelController));

export default router;