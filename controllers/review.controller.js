const Review = require('../models/Review.model');
const Business = require('../models/Business.model');
const Coupon = require('../models/Coupon.model');
const { isWithinGeofence } = require('../utils/geolocation');
const { generateCouponCode, calculateCouponExpiry } = require('../utils/coupon');
const { sendPushNotification } = require('../utils/notification');
const { generateCouponQRCode } = require('../utils/qrcode');
const logger = require('../utils/logger');

// In-memory suspicious behavior log (in production, use MongoDB collection)
const suspiciousActivityLog = [];

// Helper function to log suspicious behavior
async function logSuspiciousBehavior(userId, eventType, metadata) {
  const logEntry = {
    userId,
    eventType,
    metadata,
    timestamp: new Date(),
    ipAddress: metadata.ipAddress || null
  };

  // Store in memory (in production, save to database)
  suspiciousActivityLog.push(logEntry);

  // Keep only last 1000 entries
  if (suspiciousActivityLog.length > 1000) {
    suspiciousActivityLog.shift();
  }

  // Log to file
  logger.warn(`🚨 Suspicious Activity: ${eventType}`, logEntry);

  // TODO: In production, save to SuspiciousActivity collection
  // await SuspiciousActivity.create(logEntry);

  return logEntry;
}

// @desc    Get suspicious activities (Admin only)
// @route   GET /api/reviews/admin/suspicious-activities
// @access  Private/Admin
exports.getSuspiciousActivities = async (req, res, next) => {
  try {
    // Return in-memory suspicious activity log
    const activities = suspiciousActivityLog
      .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
      .slice(0, 100); // Last 100 entries

    res.status(200).json({
      success: true,
      count: activities.length,
      total: suspiciousActivityLog.length,
      activities
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get flagged reviews (Admin only)
// @route   GET /api/reviews/admin/flagged
// @access  Private/Admin
exports.getFlaggedReviews = async (req, res, next) => {
  try {
    const flaggedReviews = await Review.find({
      $or: [
        { status: 'flagged' },
        { 'securityMetadata.isMockLocation': true },
        { 'securityMetadata.suspiciousActivitiesCount': { $gte: 3 } },
        { 'securityMetadata.locationAccuracy': { $gt: 50 } },
        { 'securityMetadata.motionDetected': false }
      ]
    })
      .populate('user', 'name email phoneNumber')
      .populate('business', 'name address')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: flaggedReviews.length,
      reviews: flaggedReviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear suspicious activities log (Admin only)
// @route   DELETE /api/reviews/admin/suspicious-activities
// @access  Private/Admin
exports.clearSuspiciousActivities = async (req, res, next) => {
  try {
    const count = suspiciousActivityLog.length;
    suspiciousActivityLog.length = 0; // Clear array

    logger.info(`🧹 Suspicious activities log cleared by admin (${count} entries removed)`);

    res.status(200).json({
      success: true,
      message: `Cleared ${count} suspicious activity entries`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create review
// @route   POST /api/reviews
// @access  Private
exports.createReview = async (req, res, next) => {
  try {
    const {
      business: businessId,
      rating,
      comment,
      emotion, // Add emotion field
      latitude,
      longitude,
      images,
      videos, // Videos array with URLs from Cloudinary
      // 🔒 COMPREHENSIVE SECURITY METADATA from frontend
      locationAccuracy,
      verificationTime,
      motionDetected,
      isMockLocation,
      locationHistoryCount,
      suspiciousActivities,
      deviceFingerprint,
      devicePlatform
    } = req.body;

    // Geofencing security validation
    console.log(`🔒 Review attempt - User: ${req.user.id}, Business: ${businessId}`);

    // Get business
    const business = await Business.findById(businessId);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This business is not active'
      });
    }

    // SECURITY CHECK #1: Rate Limiting - Max 5 reviews per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayReviewCount = await Review.countDocuments({
      user: req.user.id,
      createdAt: { $gte: today }
    });

    if (todayReviewCount >= 5) {
      await logSuspiciousBehavior(req.user.id, 'RATE_LIMIT_EXCEEDED', {
        reviewCount: todayReviewCount,
        businessId: businessId
      });

      return res.status(429).json({
        success: false,
        message: 'Review limit reached. You can post maximum 5 reviews per day. This helps maintain review quality.'
      });
    }

    // SECURITY CHECK #2: Duplicate review check (same business, today)
    const existingReview = await Review.findOne({
      user: req.user.id,
      business: businessId,
      createdAt: { $gte: today }
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this business today'
      });
    }

    // Frontend metadata removed - doing real validation on backend now!

    // Verify geofencing - user must be within business radius
    const businessLat = business.location.coordinates[1];
    const businessLon = business.location.coordinates[0];

    // Verify geofencing
    const withinGeofence = isWithinGeofence(
      latitude,
      longitude,
      businessLat,
      businessLon,
      business.radius
    );

    const { calculateDistance } = require('../utils/geolocation');
    const actualDistance = calculateDistance(latitude, longitude, businessLat, businessLon);

    if (!withinGeofence) {
      await logSuspiciousBehavior(req.user.id, 'GEOFENCE_VIOLATION', {
        businessId: businessId,
        distance: actualDistance,
        allowedRadius: business.radius
      });

      return res.status(403).json({
        success: false,
        message: `You must be within ${business.radius}m of the business to post a review. You are currently ${actualDistance.toFixed(0)}m away.`
      });
    }

    // 🔒 COMPREHENSIVE SECURITY VALIDATION

    // GPS Accuracy check
    if (locationAccuracy && locationAccuracy > 50) {
      await logSuspiciousBehavior(req.user.id, 'POOR_GPS_ACCURACY', {
        businessId: businessId,
        accuracy: locationAccuracy
      });

      return res.status(400).json({
        success: false,
        message: `GPS accuracy is too low (${Math.round(locationAccuracy)}m). Please improve your GPS signal and try again.`
      });
    }

    // Verification time check (informational)
    if (verificationTime !== undefined && verificationTime !== 30) {
      await logSuspiciousBehavior(req.user.id, 'VERIFICATION_TIME_MISMATCH', {
        businessId: businessId,
        verificationTime: verificationTime
      });
    }

    // Mock Location detection
    if (isMockLocation === true) {
      await logSuspiciousBehavior(req.user.id, 'MOCK_LOCATION_DETECTED', {
        businessId: businessId,
        devicePlatform: devicePlatform
      });

      return res.status(403).json({
        success: false,
        message: 'Mock/fake GPS location detected. Please disable any location spoofing apps and use your real GPS location.'
      });
    }

    // Location History check
    if (locationHistoryCount !== undefined && locationHistoryCount < 5) {
      await logSuspiciousBehavior(req.user.id, 'INSUFFICIENT_LOCATION_HISTORY', {
        businessId: businessId,
        locationHistoryCount: locationHistoryCount
      });
    }

    // Suspicious Activities check
    if (suspiciousActivities && suspiciousActivities.length > 0) {
      for (const activity of suspiciousActivities) {
        await logSuspiciousBehavior(req.user.id, `FRONTEND_${activity.type}`, {
          businessId: businessId,
          ...activity.metadata,
          timestamp: activity.timestamp
        });
      }

      if (suspiciousActivities.length >= 3) {
        return res.status(403).json({
          success: false,
          message: 'Multiple security concerns detected. Your submission has been flagged for review by our team.'
        });
      }
    }

    // Device Fingerprint check
    if (deviceFingerprint) {
      const sameDeviceReviews = await Review.countDocuments({
        user: req.user.id,
        'securityMetadata.deviceFingerprint.deviceId': deviceFingerprint.deviceId,
        createdAt: { $gte: today }
      });

      if (sameDeviceReviews >= 3) {
        await logSuspiciousBehavior(req.user.id, 'MULTIPLE_DEVICE_REVIEWS', {
          businessId: businessId,
          deviceId: deviceFingerprint.deviceId,
          reviewCount: sameDeviceReviews
        });
      }
    }

    // Create review with comprehensive security metadata
    const review = await Review.create({
      user: req.user.id,
      business: businessId,
      rating,
      comment,
      emotion: emotion || null, // Add emotion field
      geolocation: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      images: images || [],
      videos: videos || [],
      verified: true,
      // Store all security metadata for auditing
      securityMetadata: {
        locationAccuracy: locationAccuracy,
        verificationTime: verificationTime,
        motionDetected: motionDetected,
        isMockLocation: isMockLocation,
        locationHistoryCount: locationHistoryCount,
        suspiciousActivitiesCount: suspiciousActivities?.length || 0,
        deviceFingerprint: deviceFingerprint,
        devicePlatform: devicePlatform,
        actualDistance: actualDistance,
        businessRadius: business.radius,
        submittedAt: new Date()
      }
    });

    // Log successful review submission
    logger.info(`✅ Review created successfully`, {
      reviewId: review._id,
      userId: req.user.id,
      businessId: businessId,
      distance: actualDistance.toFixed(2),
      businessRadius: business.radius
    });

    // Update business rating
    const reviews = await Review.find({ business: businessId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    business.rating.average = avgRating;
    business.rating.count = reviews.length;
    business.reviewCount = reviews.length;
    await business.save();

    // Get active coupon template for this business (type='business' coupons)
    const couponTemplate = await Coupon.findOne({
      business: businessId,
      type: 'business',
      isActive: true
    });

    // Check if redemption limit is reached
    if (couponTemplate && couponTemplate.redemptionLimit !== null) {
      // Count how many review_reward coupons have been redeemed for this template
      const redeemedCount = await Coupon.countDocuments({
        business: businessId,
        type: 'review_reward',
        status: 'redeemed'
      });

      if (redeemedCount >= couponTemplate.redemptionLimit) {
        // Redemption limit reached, don't issue coupon
        logger.info(`Redemption limit reached for business ${businessId}. Template limit: ${couponTemplate.redemptionLimit}, Redeemed: ${redeemedCount}`);
        // Still create the review, just without coupon
        res.status(201).json({
          success: true,
          message: 'Review posted successfully. Coupon redemption limit reached.',
          review
        });
        return;
      }
    }

    // Generate coupon as reward (2 hours validity)
    const couponCode = generateCouponCode();
    const couponExpiry = new Date();
    couponExpiry.setHours(couponExpiry.getHours() + 2); // 2 hours validity

    // Use template values or defaults
    const rewardType = couponTemplate?.rewardType || 'percentage';
    const rewardValue = couponTemplate?.rewardValue || 10;
    const description = couponTemplate?.description || 'Thank you for your review! Enjoy your reward. Valid for 2 hours.';
    const minPurchaseAmount = couponTemplate?.minPurchaseAmount || 0;
    const maxDiscountAmount = couponTemplate?.maxDiscountAmount || null;

    // Create coupon first (we'll update QR code after)
    const coupon = await Coupon.create({
      type: 'review_reward',
      business: businessId,
      user: req.user.id,
      review: review._id,
      code: couponCode,
      rewardType,
      rewardValue,
      description,
      validFrom: new Date(),
      validUntil: couponExpiry,
      minPurchaseAmount,
      maxDiscountAmount,
      status: 'active',
      terms: 'Valid for 2 hours from time of issue. Can be used once.'
    });

    // Generate QR code data with actual coupon ID
    const qrCodeData = JSON.stringify({
      type: 'coupon',
      couponId: coupon._id.toString(),
      code: couponCode,
      businessId: businessId.toString(),
      userId: req.user.id.toString(),
      reviewId: review._id.toString(),
      timestamp: new Date().toISOString()
    });

    // Update coupon with QR code data
    coupon.qrCodeData = qrCodeData;
    await coupon.save();

    // Increment template usage count (for analytics)
    if (couponTemplate) {
      await Coupon.findByIdAndUpdate(couponTemplate._id, {
        $inc: { usageCount: 1 }
      });
    }

    review.couponAwarded = true;
    review.coupon = coupon._id;
    await review.save();

    // Send notification to user
    const couponMessage = rewardType === 'percentage'
      ? `You've earned a ${rewardValue}% discount coupon! Valid for 2 hours.`
      : rewardType === 'fixed'
        ? `You've earned a ₹${rewardValue} discount coupon! Valid for 2 hours.`
        : rewardType === 'buy1get1'
          ? `You've earned a Buy 1 Get 1 coupon! Valid for 2 hours.`
          : `You've earned a free drink coupon! Valid for 2 hours.`;

    await sendPushNotification(
      req.user.id,
      'Coupon Earned! 🎉',
      couponMessage,
      { type: 'coupon', couponId: coupon._id.toString() }
    );

    // Notify business owner
    await sendPushNotification(
      business.owner,
      'New Review',
      `${req.user.name} left a ${rating}-star review for ${business.name}`,
      { type: 'review', reviewId: review._id.toString() }
    );

    res.status(201).json({
      success: true,
      message: 'Review posted successfully',
      review,
      coupon
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reviews for a business
// @route   GET /api/reviews/business/:businessId
// @access  Public
exports.getBusinessReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({
      business: req.params.businessId,
      status: 'approved'
    })
      .populate('user', 'name profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments({
      business: req.params.businessId,
      status: 'approved'
    });

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      reviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single review
// @route   GET /api/reviews/:id
// @access  Public
exports.getReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('user', 'name profileImage')
      .populate('business', 'name logo category');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.status(200).json({
      success: true,
      review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
exports.updateReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review'
      });
    }

    const { rating, comment } = req.body;

    if (rating) review.rating = rating;
    if (comment) review.comment = comment;

    await review.save();

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }

    await review.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark review as helpful
// @route   POST /api/reviews/:id/helpful
// @access  Private
exports.markHelpful = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user already marked as helpful
    if (review.helpful.includes(req.user.id)) {
      // Remove from helpful
      review.helpful = review.helpful.filter(
        userId => userId.toString() !== req.user.id
      );
    } else {
      // Add to helpful
      review.helpful.push(req.user.id);
    }

    await review.save();

    res.status(200).json({
      success: true,
      helpful: review.helpful.length
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get suspicious activities (Admin only)
// @route   GET /api/reviews/admin/suspicious-activities
// @access  Private (Admin)
exports.getSuspiciousActivities = async (req, res, next) => {
  try {
    const { limit = 100, eventType } = req.query;

    let activities = [...suspiciousActivityLog];

    // Filter by event type if specified
    if (eventType) {
      activities = activities.filter(a => a.eventType === eventType);
    }

    // Sort by most recent first
    activities.sort((a, b) => b.timestamp - a.timestamp);

    // Limit results
    activities = activities.slice(0, parseInt(limit));

    // Get summary statistics
    const stats = {
      total: suspiciousActivityLog.length,
      byType: {}
    };

    suspiciousActivityLog.forEach(activity => {
      stats.byType[activity.eventType] = (stats.byType[activity.eventType] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      count: activities.length,
      stats,
      activities
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get flagged reviews for manual review (Admin only)
// @route   GET /api/reviews/admin/flagged
// @access  Private (Admin)
exports.getFlaggedReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Find reviews with suspicious metadata
    const flaggedReviews = await Review.find({
      $or: [
        { 'metadata.verificationTime': { $lt: 10 } }, // Quick submissions
        { 'metadata.locationAccuracy': { $gt: 50 } }, // Poor GPS
        { 'metadata.locationHistoryCount': { $lt: 2 } }, // Single location
        { 'metadata.isMockLocation': true } // Mock location
      ]
    })
      .populate('user', 'name email phone')
      .populate('business', 'name address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments({
      $or: [
        { 'metadata.verificationTime': { $lt: 10 } },
        { 'metadata.locationAccuracy': { $gt: 50 } },
        { 'metadata.locationHistoryCount': { $lt: 2 } },
        { 'metadata.isMockLocation': true }
      ]
    });

    res.status(200).json({
      success: true,
      count: flaggedReviews.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      reviews: flaggedReviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear suspicious activity log (Admin only)
// @route   DELETE /api/reviews/admin/suspicious-activities
// @access  Private (Admin)
exports.clearSuspiciousActivities = async (req, res, next) => {
  try {
    const clearedCount = suspiciousActivityLog.length;
    suspiciousActivityLog.length = 0; // Clear array

    logger.info(`🧹 Suspicious activity log cleared by admin (${clearedCount} entries)`);

    res.status(200).json({
      success: true,
      message: `Cleared ${clearedCount} suspicious activity entries`
    });
  } catch (error) {
    next(error);
  }
};

