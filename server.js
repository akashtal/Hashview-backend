require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const socketIO = require('socket.io');
const { initializeSentry, Sentry } = require('./config/sentry');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const businessRoutes = require('./routes/business.routes');
const businessUpdateRoutes = require('./routes/businessUpdate.routes');
const reviewRoutes = require('./routes/review.routes');
const couponRoutes = require('./routes/coupon.routes');
const businessCouponRoutes = require('./routes/businessCoupon.routes');
const categoryRoutes = require('./routes/category.routes');
const adminRoutes = require('./routes/admin.routes');
const notificationRoutes = require('./routes/notification.routes');
const chatRoutes = require('./routes/chat.routes');
const uploadRoutes = require('./routes/upload.routes');
const externalReviewsRoutes = require('./routes/externalReviews.routes');
const verificationRoutes = require('./routes/verification.routes');
const webhookRoutes = require('./routes/webhook.routes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { initializeRedis, closeRedis } = require('./config/redis');

// Import models
const User = require('./models/User.model');

// Initialize Express
const app = express();

// Initialize Sentry BEFORE other middleware
initializeSentry(app);

// Sentry request handler must be the first middleware on the app
if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Static files
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'HashView API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
const supportRoutes = require('./routes/support.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/business', businessRoutes);
app.use('/api', businessUpdateRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/business-coupons', businessCouponRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/external-reviews', externalReviewsRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/support', supportRoutes);

// Test route for Didit API (useful for debugging in production too)
const testDiditRoutes = require('./routes/testDidit.routes');
app.use('/api/test-didit', testDiditRoutes);

// Socket.IO for real-time chat
const chatSocket = require('./sockets/chat.socket');
chatSocket(io);

// Initialize automatic sync jobs (cron)
if (process.env.ENABLE_AUTO_SYNC !== 'false') {
  const { initializeSyncJobs } = require('./utils/syncJobs');
  initializeSyncJobs();
}

// Sentry error handler must be before other error handlers
if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  app.use(Sentry.Handlers.errorHandler());
}

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found' 
  });
});

// Function to create default admin account
const createDefaultAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@hashview.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      await User.create({
        name: 'System Admin',
        email: adminEmail,
        phone: '0000000000',
        passwordHash: adminPassword,
        role: 'admin',
        status: 'active',
        emailVerified: true,
        phoneVerified: true
      });
      logger.info(`✅ Default admin account created: ${adminEmail}`);
      console.log(`✅ Default admin account created: ${adminEmail}`);
      console.log(`📧 Email: ${adminEmail}`);
      console.log(`🔑 Password: ${adminPassword}`);
    } else {
      logger.info('ℹ️  Admin account already exists');
      console.log('ℹ️  Admin account already exists');
    }
  } catch (error) {
    logger.error('❌ Error creating default admin:', error);
    console.error('❌ Error creating default admin:', error);
  }
};

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  logger.info('✅ MongoDB Connected Successfully');
  console.log('✅ MongoDB Connected Successfully');
  
  // Initialize Redis (optional)
  await initializeRedis();
  
  // Create default admin account
  await createDefaultAdmin();
})
.catch((err) => {
  logger.error('❌ MongoDB Connection Error:', err);
  console.error('❌ MongoDB Connection Error:', err);
  process.exit(1);
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Close Redis
    await closeRedis();
    
    // Close MongoDB (Mongoose 7+ doesn't accept callback)
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error);
    }
    
    process.exit(0);
  });
});

module.exports = { app, io };

