const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  // Coupon type: 'business' for manual coupons, 'review_reward' for auto-issued
  type: {
    type: String,
    enum: ['business', 'review_reward'],
    default: 'review_reward'
  },
  // For review_reward type only
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  review: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  },
  // Coupon details
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  title: {
    type: String,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  rewardType: {
    type: String,
    enum: ['percentage', 'fixed', 'buy1get1', 'free_drink', 'free_item'],
    required: true
  },
  rewardValue: {
    type: Number,
    required: true
  },
  itemName: {
    type: String,
    maxlength: [100, 'Item name cannot exceed 100 characters']
  },
  minPurchaseAmount: {
    type: Number,
    default: 0
  },
  maxDiscountAmount: {
    type: Number,
    default: null
  },
  // Validity
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date
  },
  // Usage tracking (for business type coupons)
  usageLimit: {
    type: Number,
    default: null // null = unlimited
  },
  usageCount: {
    type: Number,
    default: 0
  },
  // Redemption tracking (for business type coupon templates)
  redemptionLimit: {
    type: Number,
    default: null // How many users can redeem coupons from this template (e.g., 10)
  },
  redemptionCount: {
    type: Number,
    default: 0 // How many coupons have been redeemed
  },
  // Status
  status: {
    type: String,
    enum: ['active', 'redeemed', 'expired', 'cancelled', 'inactive'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Redemption (for review_reward type - individual user coupons)
  redeemedAt: Date,
  redeemedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // QR Code data for coupon redemption
  qrCodeData: {
    type: String // JSON stringified QR code data
  },
  terms: {
    type: String,
    maxlength: [1000, 'Terms cannot exceed 1000 characters']
  }
}, {
  timestamps: true
});

// Index for queries
couponSchema.index({ code: 1 });
couponSchema.index({ user: 1, status: 1 });
couponSchema.index({ business: 1, type: 1 });
couponSchema.index({ validUntil: 1 });
couponSchema.index({ type: 1, isActive: 1 });

// Method to check if coupon is valid
couponSchema.methods.isValid = function() {
  const now = new Date();
  
  // Check if active
  if (!this.isActive || this.status === 'inactive') return false;
  
  // Check date validity
  if (this.validFrom && now < this.validFrom) return false;
  if (this.validUntil && now > this.validUntil) return false;
  
  // For business type, check usage limit
  if (this.type === 'business' && this.usageLimit && this.usageCount >= this.usageLimit) {
    return false;
  }
  
  // For review_reward type, check if already redeemed
  if (this.type === 'review_reward' && this.status === 'redeemed') {
    return false;
  }
  
  return true;
};

module.exports = mongoose.model('Coupon', couponSchema);

