const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: [true, 'Comment is required'],
    minlength: [10, 'Comment must be at least 10 characters'],
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  images: [{
    url: String,
    publicId: String
  }],
  geolocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  verified: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'approved'
  },
  likes: {
    type: Number,
    default: 0
  },
  dislikes: {
    type: Number,
    default: 0
  },
  helpful: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  couponAwarded: {
    type: Boolean,
    default: false
  },
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },
  // 🔒 COMPREHENSIVE SECURITY METADATA
  securityMetadata: {
    locationAccuracy: Number, // GPS accuracy in meters
    verificationTime: Number, // Time spent verifying (seconds)
    motionDetected: Boolean, // Was device movement detected
    isMockLocation: Boolean, // Was fake GPS detected
    locationHistoryCount: Number, // Number of location updates during verification
    suspiciousActivitiesCount: Number, // Number of suspicious events detected
    deviceFingerprint: {
      deviceId: String,
      deviceName: String,
      manufacturer: String,
      modelName: String,
      osName: String,
      osVersion: String,
      platform: String,
      platformVersion: mongoose.Schema.Types.Mixed,
      isDevice: Boolean
    },
    devicePlatform: String, // ios/android
    actualDistance: Number, // Actual distance from business (meters)
    businessRadius: Number, // Allowed radius at time of submission
    submittedAt: Date
  }
}, {
  timestamps: true
});

// Index for queries
reviewSchema.index({ business: 1, createdAt: -1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ geolocation: '2dsphere' });

// Prevent duplicate reviews (one review per user per business per day)
reviewSchema.index({ user: 1, business: 1, createdAt: 1 });

module.exports = mongoose.model('Review', reviewSchema);

