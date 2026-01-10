const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const businessOwnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^\+?[0-9]{7,15}$/, 'Please provide a valid phone number with country code']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  role: {
    type: String,
    default: 'business',
    enum: ['business']
  },
  address: {
    buildingNumber: String,
    street: String,
    city: String,
    county: String,
    state: String,
    postcode: String,
    country: { type: String, default: 'United Kingdom' },
    landmark: String,
    fullAddress: String
  },
  profileImage: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  businesses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business'
  }],
  pushToken: {
    type: String,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  settings: {
    twoFactorAuth: {
      type: Boolean,
      default: false
    },
    loginAlerts: {
      type: Boolean,
      default: true
    },
    dataSharing: {
      type: Boolean,
      default: false
    },
    marketingEmails: {
      type: Boolean,
      default: true
    },
    pushNotifications: {
      type: Boolean,
      default: true
    },
    emailNotifications: {
      type: Boolean,
      default: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
businessOwnerSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
businessOwnerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to get public profile
businessOwnerSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    profileImage: this.profileImage,
    status: this.status,
    emailVerified: this.emailVerified,
    phoneVerified: this.phoneVerified,
    address: this.address,
    businesses: this.businesses,
    createdAt: this.createdAt
  };
};

// Remove sensitive data when converting to JSON
businessOwnerSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

// Index for faster queries
businessOwnerSchema.index({ email: 1 });
businessOwnerSchema.index({ phone: 1 });
businessOwnerSchema.index({ status: 1 });

module.exports = mongoose.model('BusinessOwner', businessOwnerSchema);

