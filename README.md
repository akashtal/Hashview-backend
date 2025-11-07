# HashView Backend API

Complete Node.js Express backend for HashView mobile application with MongoDB, JWT authentication, geofencing, and real-time chat.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- SendGrid API key (for emails)
- Cloudinary account (optional, for image uploads)

### Installation

1. Install dependencies:
```bash
cd backend
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Update `.env` with your credentials:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@hashview.com

# Default Admin Account (Optional - defaults will be used if not set)
ADMIN_EMAIL=admin@hashview.com
ADMIN_PASSWORD=Admin@123
```

4. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## 📁 Project Structure

```
backend/
├── controllers/       # Request handlers
├── models/           # MongoDB schemas
├── routes/           # API endpoints
├── middleware/       # Auth, validation, error handling
├── utils/            # Helper functions
├── sockets/          # Socket.io real-time chat
├── uploads/          # File upload directory
├── logs/             # Application logs
└── server.js         # Entry point
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/send-otp` - Send OTP for phone login
- `POST /api/auth/login-phone` - Login with phone/OTP
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/push-token` - Update push notification token

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/reviews` - Get user reviews
- `GET /api/users/coupons` - Get user coupons
- `GET /api/users/rewards` - Get reward history
- `POST /api/users/upload-image` - Upload profile image
- `DELETE /api/users/account` - Delete user account

### Business
- `POST /api/business/register` - Register new business
- `POST /api/business/:id/documents` - Upload business documents
- `GET /api/business/nearby` - Get nearby businesses (geolocation)
- `GET /api/business/search` - Search businesses
- `GET /api/business/:id` - Get single business
- `GET /api/business/:id/dashboard` - Get business dashboard
- `POST /api/business/:id/generate-qr` - Generate QR code
- `PUT /api/business/:id` - Update business
- `GET /api/business/my/businesses` - Get my businesses

### Reviews
- `POST /api/reviews` - Create review (with geofencing)
- `GET /api/reviews/business/:businessId` - Get business reviews
- `GET /api/reviews/:id` - Get single review
- `PUT /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review
- `POST /api/reviews/:id/helpful` - Mark review as helpful

### Coupons
- `GET /api/coupons` - Get user coupons
- `GET /api/coupons/:id` - Get single coupon
- `POST /api/coupons/verify` - Verify coupon code
- `POST /api/coupons/:id/redeem` - Redeem coupon
- `GET /api/coupons/business/:businessId` - Get business coupons
- `POST /api/coupons/calculate-discount` - Calculate discount

### Admin
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/users` - Get all users
- `GET /api/admin/businesses` - Get all businesses
- `PUT /api/admin/businesses/:id/kyc` - Approve/reject business KYC
- `PUT /api/admin/users/:id/status` - Update user status
- `GET /api/admin/reviews` - Get all reviews
- `PUT /api/admin/reviews/:id/status` - Update review status
- `POST /api/admin/notifications/send` - Send push notifications
- `DELETE /api/admin/users/:id` - Delete user
- `DELETE /api/admin/businesses/:id` - Delete business

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Chat
- `GET /api/chat/conversations` - Get chat list
- `GET /api/chat/:userId` - Get chat history
- `POST /api/chat` - Send message

## 🔐 Authentication & Authorization

### User Roles
The system supports three user roles:
1. **Customer** - Regular users who can search businesses, write reviews, and earn coupons
2. **Business** - Business owners who can register and manage their businesses
3. **Admin** - System administrators with full access to manage users, businesses, and reviews

### Default Admin Account
When the server starts, a default admin account is automatically created:
- **Email**: `admin@hashview.com` (or value from `ADMIN_EMAIL` env variable)
- **Password**: `Admin@123` (or value from `ADMIN_PASSWORD` env variable)

**Important Notes:**
- Admin accounts CANNOT be created through the registration API
- Admin can login through the customer login page on the mobile app
- Change the default admin credentials in production via environment variables
- Only one admin account is created on first server start

### Role-Based Access Control
All protected routes require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

Routes are protected based on user roles:
- **Customer routes**: Available to customers only
- **Business routes**: Available to business owners only  
- **Admin routes**: Available to admins only (prefixed with `/api/admin`)

## 🌍 Geofencing

Reviews can only be posted within the business radius (default 50m). The system uses MongoDB geospatial queries to verify user location.

## 📱 Push Notifications

Using Expo Push Notification service. Users must provide push token via `/api/auth/push-token` endpoint.

## 🔌 Real-time Chat

Socket.io implementation for real-time messaging:
- Connect with JWT token
- Events: `send_message`, `receive_message`, `typing`, `user_online`, `user_offline`

## 🗄️ Database Models

- **User**: User accounts with roles (customer, business, admin)
- **Business**: Business profiles with geolocation
- **Review**: User reviews with geofencing validation
- **Coupon**: Reward coupons with 2-hour validity
- **Notification**: Push notifications
- **Chat**: Real-time messages

## 📝 Logging

Using Winston logger. Logs saved to:
- `logs/error.log` - Error logs only
- `logs/combined.log` - All logs

## 🚀 Deployment

Recommended platforms:
- **Render** (https://render.com)
- **Railway** (https://railway.app)
- **Heroku**
- **AWS Elastic Beanstalk**

Environment variables must be set on the deployment platform.

## 📄 License

MIT

