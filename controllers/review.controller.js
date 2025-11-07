const Review = require('../models/Review.model');
const Business = require('../models/Business.model');
const Coupon = require('../models/Coupon.model');
const { isWithinGeofence } = require('../utils/geolocation');
const { generateCouponCode, calculateCouponExpiry } = require('../utils/coupon');
const { sendPushNotification } = require('../utils/notification');

// @desc    Create review
// @route   POST /api/reviews
// @access  Private
exports.createReview = async (req, res, next) => {
  try {
    const { business: businessId, rating, comment, latitude, longitude, images } = req.body;

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

    // Check if user already reviewed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
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

    // Verify geofencing - user must be within business radius
    const businessLat = business.location.coordinates[1];
    const businessLon = business.location.coordinates[0];
    
    // Debug logging
    console.log('\n🌍 Geofence Check:');
    console.log(`   Business: ${business.name}`);
    console.log(`   Business Location: [${businessLon}, ${businessLat}]`);
    console.log(`   User Location: [${longitude}, ${latitude}]`);
    console.log(`   Allowed Radius: ${business.radius}m`);
    
    const withinGeofence = isWithinGeofence(
      latitude,
      longitude,
      businessLat,
      businessLon,
      business.radius
    );
    
    // Calculate actual distance for debugging
    const { calculateDistance } = require('../utils/geolocation');
    const actualDistance = calculateDistance(latitude, longitude, businessLat, businessLon);
    console.log(`   Actual Distance: ${actualDistance.toFixed(2)}m`);
    console.log(`   Within Geofence: ${withinGeofence}`);

    if (!withinGeofence) {
      console.log(`   ❌ BLOCKED: User is ${actualDistance.toFixed(2)}m away (limit: ${business.radius}m)`);
      return res.status(400).json({
        success: false,
        message: `You must be within ${business.radius}m of the business to post a review. You are currently ${actualDistance.toFixed(0)}m away.`
      });
    }
    
    console.log(`   ✅ ALLOWED: User is within geofence`);


    // Create review
    const review = await Review.create({
      user: req.user.id,
      business: businessId,
      rating,
      comment,
      geolocation: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      images: images || [],
      verified: true
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

