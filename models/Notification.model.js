const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  sentTo: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'sentToModel',
    required: true
  },
  sentToModel: {
    type: String,
    enum: ['User', 'BusinessOwner'],
    default: 'User'
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  type: {
    type: String,
    enum: ['general', 'coupon', 'review', 'business_verification', 'kyc', 'system', 'admin_broadcast', 'promotion', 'announcement'],
    default: 'general'
  },
  recipientType: {
    type: String,
    enum: ['all_users', 'all_businesses', 'specific_user', 'specific_business', 'individual'],
    default: 'individual'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'read'],
    default: 'pending'
  },
  readAt: Date,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  expoTicketId: String,
  errorMessage: String
}, {
  timestamps: true
});

// Index for queries
notificationSchema.index({ sentTo: 1, createdAt: -1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);

