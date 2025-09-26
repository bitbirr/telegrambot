# 🏨 eQabo Booking Workflow API

A comprehensive REST API for hotel booking workflow built with Express 5.x, featuring room availability checking, payment processing, and PDF receipt generation.

## 🚀 Features

- **Full Booking Workflow**: Complete hotel booking process from city selection to payment
- **Room Availability**: Real-time room availability checking with reservation prevention
- **Payment Integration**: Multiple payment providers with callback handling
- **PDF Receipts**: Automatic receipt generation with multi-language support
- **Security**: Rate limiting, CORS, helmet protection, input validation
- **Monitoring**: Health checks, performance metrics, comprehensive logging
- **Fallback**: Graceful degradation when services are unavailable

## 📋 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cities` | List all destination cities |
| `GET` | `/api/hotels?city_id=xxx` | List hotels for a given city |
| `GET` | `/api/rooms?hotel_id=xxx&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD` | Check room availability |
| `POST` | `/api/bookings` | Create booking (status: pending_payment) |
| `POST` | `/api/payments/initiate` | Start push payment with provider |
| `POST` | `/api/payments/callback` | Handle payment confirmation/failure |
| `GET` | `/api/receipts/:booking_id` | Generate and return PDF receipt |

### Utility Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check endpoint |
| `GET` | `/api/status` | API status and statistics |

## 🛠️ Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

Run the database schema to create required tables:

```bash
# Apply the booking API schema
psql -d your_database -f database-booking-api-schema.sql
```

### 3. Environment Variables

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# API Configuration
API_PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,https://eqabo.com

# Payment Configuration (optional)
PAYMENT_RETURN_URL=https://eqabo.com/booking-success
```

### 4. Start the API Server

```bash
# Production
npm run start:api

# Development with auto-reload
npm run dev:api

# Both bot and API together
npm run start:both
```

## 📖 API Usage Examples

### 1. Get Cities

```bash
curl -X GET "http://localhost:3001/api/cities?language=en"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-city-id",
      "key": "addis_ababa",
      "name": "Addis Ababa",
      "names": {
        "en": "Addis Ababa",
        "am": "አዲስ አበባ"
      },
      "coordinates": {
        "latitude": 9.0054,
        "longitude": 38.7636
      }
    }
  ],
  "count": 1
}
```

### 2. Get Hotels

```bash
curl -X GET "http://localhost:3001/api/hotels?city_id=uuid-city-id&language=en"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-hotel-id",
      "name": "Grand Palace Hotel",
      "description": "Luxury hotel in the heart of Addis Ababa",
      "price_per_night": 2500,
      "rating": 5,
      "amenities": ["WiFi", "Pool", "Spa", "Restaurant"],
      "images": ["hotel1.jpg", "hotel2.jpg"],
      "coordinates": {
        "latitude": 9.0054,
        "longitude": 38.7636
      },
      "city": {
        "id": "uuid-city-id",
        "key": "addis_ababa",
        "name": "Addis Ababa"
      }
    }
  ],
  "count": 1
}
```

### 3. Check Room Availability

```bash
curl -X GET "http://localhost:3001/api/rooms?hotel_id=uuid-hotel-id&checkin=2024-12-01&checkout=2024-12-03"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hotel_id": "uuid-hotel-id",
    "checkin": "2024-12-01",
    "checkout": "2024-12-03",
    "available_rooms": [
      {
        "id": "uuid-room-id",
        "room_type": "deluxe",
        "room_number": "201",
        "capacity": 3,
        "price_per_night": 3000,
        "amenities": ["WiFi", "TV", "AC", "Mini Bar", "Balcony"],
        "available": true,
        "hotel": {
          "id": "uuid-hotel-id",
          "name": "Grand Palace Hotel"
        }
      }
    ],
    "reserved_rooms": [],
    "summary": {
      "total_rooms": 10,
      "available": 8,
      "reserved": 2
    }
  }
}
```

### 4. Create Booking

```bash
curl -X POST "http://localhost:3001/api/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 123456789,
    "room_id": "uuid-room-id",
    "hotel_id": "uuid-hotel-id",
    "check_in_date": "2024-12-01",
    "check_out_date": "2024-12-03",
    "guests": 2,
    "payment_method_id": "uuid-payment-method-id",
    "special_requests": "Late check-in requested",
    "user_details": {
      "username": "john_doe",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "language": "en"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "booking_id": "uuid-booking-id",
    "booking_reference": "EQB-20241201-ABC12345",
    "status": "pending_payment",
    "payment_status": "pending",
    "total_amount": 6000,
    "nights": 2,
    "check_in_date": "2024-12-01",
    "check_out_date": "2024-12-03",
    "room": {
      "id": "uuid-room-id",
      "type": "deluxe",
      "number": "201"
    },
    "hotel": {
      "id": "uuid-hotel-id",
      "name": "Grand Palace Hotel"
    }
  },
  "message": "Booking created successfully. Please proceed to payment."
}
```

### 5. Initiate Payment

```bash
curl -X POST "http://localhost:3001/api/payments/initiate" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "uuid-booking-id",
    "payment_method": "telebirr",
    "phone_number": "+251911234567",
    "return_url": "https://eqabo.com/booking-success"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment_id": "uuid-payment-id",
    "payment_reference": "PAY_EQB-20241201-ABC12345_1701234567",
    "provider_transaction_id": "TXN_1701234567_abc123def",
    "payment_url": "https://payment.provider.com/pay?ref=PAY_EQB-20241201-ABC12345_1701234567&amount=6000",
    "amount": 6000,
    "currency": "ETB",
    "expires_at": "2024-12-01T15:30:00Z",
    "booking_reference": "EQB-20241201-ABC12345"
  },
  "message": "Payment initiated successfully"
}
```

### 6. Payment Callback (Provider → API)

```bash
curl -X POST "http://localhost:3001/api/payments/callback" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_transaction_id": "TXN_1701234567_abc123def",
    "status": "success",
    "amount": 6000,
    "callback_data": {
      "transaction_time": "2024-12-01T14:45:00Z",
      "confirmation_code": "ABC123XYZ"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment_id": "uuid-payment-id",
    "booking_id": "uuid-booking-id",
    "status": "success",
    "booking_status": "confirmed"
  },
  "message": "Payment completed successfully"
}
```

### 7. Generate Receipt

```bash
curl -X GET "http://localhost:3001/api/receipts/uuid-booking-id?download=true" \
  --output booking_receipt.pdf
```

Returns a PDF file with the booking receipt.

## 🔍 Testing

### Run API Tests

```bash
# Run comprehensive API test suite
npm run test:api

# Run booking flow test
npm run test:booking

# Run health check
npm run test:health
```

### Manual Testing

```bash
# Start API server
npm run start:api

# Test individual endpoints
curl http://localhost:3001/api/status
curl http://localhost:3001/api/health
curl http://localhost:3001/api/cities
```

## 📊 Monitoring

### Health Check

The `/api/health` endpoint provides service health information:

```json
{
  "status": "healthy",
  "timestamp": "2024-12-01T14:30:00Z",
  "services": {
    "database": "healthy",
    "api": "healthy"
  }
}
```

Status levels:
- `healthy`: All services operational
- `degraded`: API operational but database issues
- `unhealthy`: Critical issues

### Performance Monitoring

Access `/api/status` for operational statistics:

```json
{
  "status": "operational",
  "timestamp": "2024-12-01T14:30:00Z",
  "version": "1.0.0",
  "database_connected": true,
  "statistics": {
    "active_cities": 15,
    "active_hotels": 150,
    "total_bookings": 2847
  },
  "endpoints": {
    "/api/cities": "GET - List all destination cities",
    "/api/hotels": "GET - List hotels for a city",
    "...": "..."
  }
}
```

## 🛡️ Security Features

- **Rate Limiting**: 100 requests per 15 minutes for general API, 10 per 5 minutes for payments
- **CORS**: Configurable allowed origins
- **Helmet**: Security headers and protection
- **Input Validation**: Comprehensive parameter validation
- **Error Handling**: Graceful error responses without sensitive data exposure

## 🎯 Telegram Bot Integration

The API seamlessly integrates with the Telegram bot:

1. **Visual Room Selection**: Bot displays available rooms in a grid UI
2. **Real-time Availability**: Checks room availability before showing options
3. **Payment Flow**: Integrated payment processing with provider callbacks
4. **Fallback**: Graceful fallback to direct database when API unavailable

### Enhanced Bot Features

- 🟢 **Available Rooms**: Visual indicators for available rooms
- 🔴 **Reserved Rooms**: Clear marking of unavailable rooms
- 💳 **Payment Options**: Multiple payment methods (Telebirr, Chappa, eBirr, Bank Transfer)
- 📄 **Instant Receipts**: PDF receipts delivered via Telegram
- 🔄 **Real-time Updates**: Payment status updates and confirmations

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Telegram Bot  │ ───│  Booking API     │ ───│   Supabase DB   │
│   (Frontend)    │    │  (Express 5.x)   │    │   (Backend)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌────────────────┐              │
         └──────────────│  API Service   │──────────────┘
                        │   (Bridge)     │
                        └────────────────┘
                                 │
                        ┌────────────────┐
                        │ Payment Provider│
                        │   Callbacks     │
                        └────────────────┘
```

## 📝 Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human-readable error description"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `500`: Internal Server Error
- `503`: Service Unavailable (database issues)

## 🔄 Deployment

### Production Deployment

```bash
# Start production API server
NODE_ENV=production npm run start:api

# Or with PM2 for process management
pm2 start src/api/bookingApi.js --name "eqabo-booking-api"
```

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ src/
EXPOSE 3001
CMD ["npm", "run", "start:api"]
```

### Environment-specific Configurations

- **Development**: Auto-reload, detailed error messages
- **Production**: Optimized logging, security hardening
- **Testing**: Mock payment providers, test database

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make changes and test thoroughly
4. Run the test suite: `npm run test:api`
5. Commit changes: `git commit -am 'Add new feature'`
6. Push to branch: `git push origin feature/new-feature`
7. Create a Pull Request

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for eQabo.com - Ethiopia's #1 Hotel Booking Platform**