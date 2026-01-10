const mongoose = require('mongoose');

const suspendedAccountSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    unique: true,
    index: true
  },
  accountType: {
    type: String,
    required: true,
    enum: ['user', 'business', 'businessOwner'],
    index: true
  },
  originalAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  suspendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: [true, 'Suspension reason is required'],
    trim: true
  },
  suspendedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  unsuspendedAt: {
    type: Date,
    default: null
  },
  unsuspendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['suspended', 'unsuspended'],
    default: 'suspended',
    index: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
suspendedAccountSchema.index({ email: 1, status: 1 });
suspendedAccountSchema.index({ accountType: 1, status: 1 });

module.exports = mongoose.model('SuspendedAccount', suspendedAccountSchema);

