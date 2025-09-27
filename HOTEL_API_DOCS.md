# Hotel/Rooms API Endpoints

This implementation provides REST API endpoints for hotel and room management with availability checking functionality.

## Endpoints

### 1. List Hotels
**GET** `/api/hotels`

Lists all active hotels with optional filtering and pagination.

**Query Parameters:**
- `city` (optional): Filter by city key (e.g., 'addis_ababa')
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Example Request:**
```bash
GET /api/hotels?city=addis_ababa&limit=10&offset=0
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-string",
      "name": "Hotel Name",
      "price_per_night": 500,
      "rating": 4,
      "description": { "en": "English description", "am": "Amharic description" },
      "images": ["url1", "url2"],
      "coordinates": { "latitude": 9.0054, "longitude": 38.7636 },
      "amenities": ["wifi", "pool"],
      "city": {
        "id": "city-uuid",
        "key": "addis_ababa",
        "name": { "en": "Addis Ababa", "am": "አዲስ አበባ" }
      },
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 25
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 2. Get Hotel by ID
**GET** `/api/hotels/:id`

Retrieves detailed information about a specific hotel.

**Path Parameters:**
- `id`: Hotel UUID

**Example Request:**
```bash
GET /api/hotels/550e8400-e29b-41d4-a716-446655440000
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Hotel Name",
    "price_per_night": 500,
    "rating": 4,
    "description": { "en": "English description" },
    "images": ["url1", "url2"],
    "coordinates": { "latitude": 9.0054, "longitude": 38.7636 },
    "amenities": ["wifi", "pool"],
    "city": {
      "id": "city-uuid",
      "key": "addis_ababa", 
      "name": { "en": "Addis Ababa" }
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 3. List Hotel Rooms with Availability
**GET** `/api/hotels/:id/rooms`

Lists rooms for a hotel with optional availability filtering.

**Path Parameters:**
- `id`: Hotel UUID

**Query Parameters:**
- `checkin` (optional): Check-in date in YYYY-MM-DD format
- `checkout` (optional): Check-out date in YYYY-MM-DD format

**Note:** If both `checkin` and `checkout` are provided, only available rooms are returned.

**Example Request:**
```bash
GET /api/hotels/550e8400-e29b-41d4-a716-446655440000/rooms?checkin=2024-06-01&checkout=2024-06-03
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Hotel Room",
      "price_per_night": 500,
      "rating": 4,
      "description": { "en": "Room description" },
      "images": ["url1"],
      "coordinates": { "latitude": 9.0054, "longitude": 38.7636 },
      "amenities": ["wifi"],
      "city": {
        "id": "city-uuid",
        "key": "addis_ababa",
        "name": { "en": "Addis Ababa" }
      },
      "availability": {
        "available": true,
        "checkin": "2024-06-01",
        "checkout": "2024-06-03",
        "checked_at": "2024-01-01T12:00:00Z"
      }
    }
  ],
  "filters": {
    "checkin": "2024-06-01",
    "checkout": "2024-06-03"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `404`: Not Found (hotel not found)
- `503`: Service Unavailable (database not configured)
- `500`: Internal Server Error

## Availability Logic

The availability checking uses the following SQL logic:

```sql
SELECT COUNT(*) FROM bookings 
WHERE hotel_id = $1 
  AND status IN ('pending_payment', 'confirmed')
  AND check_in_date < $3 
  AND check_out_date > $2
```

A room/hotel is considered available if the count is 0 (no conflicting bookings).

## Database Schema

The implementation expects these tables:
- `hotels`: Hotel information with city relationships
- `cities`: City data with multi-language names
- `bookings`: Booking records with status and date ranges

## Configuration

Set these environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon/public key

Without these, endpoints will return 503 Service Unavailable.

## Testing

Run the validation test:
```bash
node test-hotel-api.js
```

## Swagger Documentation

All endpoints are fully documented with Swagger/OpenAPI specifications included in the route definitions.