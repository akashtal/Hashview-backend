const mongoose = require('mongoose');

const businessUpdateSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  type: {
    type: String,
    enum: ['offer', 'update', 'announcement'],
    required: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  image: {
    url: String,
    publicId: String
  },
  // For offers
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', 'none'],
    default: 'none'
  },
  discountValue: {
    type: Number,
    default: 0
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessOwner'
  }
}, {
  timestamps: true
});

// Index for efficient queries
businessUpdateSchema.index({ business: 1, isActive: 1, createdAt: -1 });

module.exports = mongoose.model('BusinessUpdate', businessUpdateSchema);

