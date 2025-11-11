const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
    minlength: [2, 'Business name must be at least 2 characters'],
    maxlength: [100, 'Business name cannot exceed 100 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ownerName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Business email is required'],
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Business phone is required']
  },
  category: {
    type: String,
    required: [true, 'Business category is required'],
    enum: ['restaurant', 'cafe', 'retail', 'services', 'healthcare', 'education', 'entertainment', 'salon', 'hotel', 'gym', 'other']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  address: {
    street: String,
    area: String,  // Locality/Area
    city: String,
    state: String,
    country: { type: String, default: 'India' },
    zipCode: String,
    pincode: String,  // Indian PIN code (alias for zipCode)
    landmark: String,  // Nearby landmark
    fullAddress: String
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function(v) {
          return Array.isArray(v) && v.length === 2 && 
                 v[0] >= -180 && v[0] <= 180 && // longitude
                 v[1] >= -90 && v[1] <= 90;     // latitude
        },
        message: 'Invalid coordinates. Longitude must be between -180 and 180, Latitude must be between -90 and 90'
      }
    }
  },
  radius: {
    type: Number,
    default: 50, // 50 meters default radius for geofencing
    min: 10,
    max: 500
  },
  images: [{
    url: String,
    publicId: String
  }],
  logo: {
    url: String,
    publicId: String
  },
  coverImage: {
    url: String,
    publicId: String
  },
  selfieUrl: String, // Owner selfie for face matching
  selfiePublicId: String,
  submittedForReviewAt: Date, // When documents were submitted
  
  // Didit Comprehensive KYC Verification (Custom Workflow)
  // Uses Didit's hosted UI for all verification steps
  diditVerification: {
    sessionId: String,
    workflowId: String,
    verificationLink: String,
    linkExpiresAt: Date,
    status: {
      type: String,
      enum: ['not_started', 'pending', 'in_progress', 'completed', 'failed', 'expired'],
      default: 'not_started'
    },
    
    // 1. ID Verification (Passport, Driver's License, National ID)
    idVerification: {
      status: { type: String, enum: ['pending', 'verified', 'failed'] },
      documentType: String,
      documentNumber: String,
      fullName: String,
      dateOfBirth: Date,
      expiryDate: Date,
      issuingCountry: String,
      extractedData: mongoose.Schema.Types.Mixed,
      verifiedAt: Date
    },
    
    // 2. Liveness Check (Ensure person is real and present)
    liveness: {
      status: { type: String, enum: ['pending', 'passed', 'failed'] },
      confidence: Number, // 0-1 score
      type: String, // 'active' or 'passive'
      verifiedAt: Date
    },
    
    // 3. Face Match (Compare selfie with ID photo)
    faceMatch: {
      status: { type: String, enum: ['pending', 'matched', 'not_matched'] },
      similarity: Number, // 0-1 score
      confidence: Number,
      threshold: Number,
      verifiedAt: Date
    },
    
    // 4. Proof of Address (Utility bill, bank statement, etc.)
    proofOfAddress: {
      status: { type: String, enum: ['pending', 'verified', 'failed'] },
      documentType: String,
      address: String,
      documentDate: Date,
      documentAge: Number, // Days old
      verifiedAt: Date
    },
    
    // 5. Phone Verification (SMS OTP)
    phoneVerification: {
      status: { type: String, enum: ['pending', 'verified', 'failed'] },
      phoneNumber: String,
      countryCode: String,
      carrier: String,
      verifiedAt: Date
    },
    
    // 6. IP Analysis (Fraud detection, geolocation)
    ipAnalysis: {
      ipAddress: String,
      country: String,
      city: String,
      region: String,
      timezone: String,
      isVPN: Boolean,
      isProxy: Boolean,
      isTor: Boolean,
      riskScore: Number, // 0-100 (higher is more risky)
      analyzedAt: Date
    },
    
    // Overall result
    overallResult: { type: String, enum: ['pass', 'fail', 'review'] },
    completedAt: Date,
    failureReason: String,
    submittedAt: Date,
    rawData: mongoose.Schema.Types.Mixed // Store full Didit response for reference
  },
  
  // KYC Status
  kycStatus: {
    type: String,
    enum: ['pending', 'in_review', 'verified', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // Admin verification (after Didit)
  adminVerification: {
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    notes: String,
    rejectionReason: String
  },
  
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'suspended', 'rejected'],
    default: 'pending'
  },
  qrCode: {
    type: String,
    default: null
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  openingHours: {
    monday: { open: String, close: String, closed: Boolean },
    tuesday: { open: String, close: String, closed: Boolean },
    wednesday: { open: String, close: String, closed: Boolean },
    thursday: { open: String, close: String, closed: Boolean },
    friday: { open: String, close: String, closed: Boolean },
    saturday: { open: String, close: String, closed: Boolean },
    sunday: { open: String, close: String, closed: Boolean }
  },
  socialMedia: {
    facebook: String,
    instagram: String,
    twitter: String,
    website: String
  },
  externalProfiles: {
    tripAdvisor: {
      profileUrl: String,
      rating: Number,
      reviewCount: Number,
      lastSynced: Date,
      commonNinjaWidgetId: String, // Common Ninja widget ID for TripAdvisor reviews
      commonNinjaWidgetUrl: String // Widget URL for embedding
    },
    googleBusiness: {
      businessName: String,
      placeId: String, // Google Place ID
      rating: Number,
      reviewCount: Number,
      lastSynced: Date
    }
  },
  externalReviews: {
    tripAdvisor: [{
      reviewId: String,
      author: String,
      authorPhoto: String,
      rating: Number,
      text: String,
      title: String,
      date: Date,
      url: String,
      helpful: Number
    }],
    google: [{
      reviewId: String,
      author: String,
      authorPhoto: String,
      rating: Number,
      text: String,
      date: Date,
      relativeTime: String
    }]
  },
  rejectionReason: String,
  verifiedAt: Date,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for geospatial queries
businessSchema.index({ location: '2dsphere' }, { sparse: true });
businessSchema.index({ owner: 1 });
businessSchema.index({ category: 1 });
businessSchema.index({ status: 1 });

module.exports = mongoose.model('Business', businessSchema);

