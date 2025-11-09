const Coupon = require('../models/Coupon.model');
const Business = require('../models/Business.model');
const { isCouponValid, calculateDiscount, generateCouponCode } = require('../utils/coupon');
const crypto = require('crypto');

// @desc    Get user coupons
// @route   GET /api/coupons
// @access  Private
exports.getCoupons = async (req, res, next) => {
  try {
    const { status } = req.query;
    
    const query = { user: req.user.id };
    if (status) query.status = status;
    
    // CRITICAL FIX: Only return non-expired coupons
    query.validUntil = { $gte: new Date() };

    const coupons = await Coupon.find(query)
      .populate('business', 'name logo address')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: coupons.length,
      coupons
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new coupon
// @route   POST /api/coupons
// @access  Private (Business owner, Admin)
exports.createCoupon = async (req, res, next) => {
  try {
    const {
      businessId,
      userId,
      reviewId,
      rewardType,
      rewardValue,
      description,
      validUntil,
      minPurchaseAmount,
      maxDiscountAmount,
      termsAndConditions
    } = req.body;

    // Verify business exists
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Check authorization - must be business owner or admin
    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create coupons for this business'
      });
    }

    // Find user by phone number if userId looks like a phone number
    let targetUserId = userId;
    if (userId && /^\d+$/.test(userId)) {
      // It's a phone number, look up the user
      const User = require('../models/User.model');
      const user = await User.findOne({ phone: userId });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: `No user found with phone number: ${userId}`
        });
      }
      targetUserId = user._id;
    }

    // Generate unique coupon code using utility function
    let code;
    let isUnique = false;
    while (!isUnique) {
      code = generateCouponCode(); // Uses HASH- prefix for consistency
      const existing = await Coupon.findOne({ code });
      if (!existing) isUnique = true;
    }

    // Create coupon
    const coupon = await Coupon.create({
      business: businessId,
      user: targetUserId,
      review: reviewId,
      code,
      rewardType,
      rewardValue,
      description,
      validUntil,
      minPurchaseAmount: minPurchaseAmount || 0,
      maxDiscountAmount: maxDiscountAmount || null,
      termsAndConditions
    });

    // Populate for response
    await coupon.populate('business', 'name logo address');
    await coupon.populate('user', 'name email phone');

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single coupon
// @route   GET /api/coupons/:id
// @access  Private
exports.getCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate('business', 'name logo address phone')
      .populate('user', 'name email phone');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Check authorization
    if (coupon.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this coupon'
      });
    }

    res.status(200).json({
      success: true,
      coupon
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify coupon by code
// @route   POST /api/coupons/verify
// @access  Private (Business owner)
exports.verifyCoupon = async (req, res, next) => {
  try {
    const { code } = req.body;

    const coupon = await Coupon.findOne({ code })
      .populate('business', 'name')
      .populate('user', 'name email phone');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Get business to check ownership
    const business = await Business.findById(coupon.business._id);
    
    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to verify this coupon'
      });
    }

    // Check if coupon is valid
    if (!isCouponValid(coupon)) {
      return res.status(400).json({
        success: false,
        message: 'Coupon is expired or invalid',
        coupon
      });
    }

    res.status(200).json({
      success: true,
      message: 'Coupon is valid',
      coupon
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Redeem coupon
// @route   POST /api/coupons/:id/redeem
// @access  Private (Business owner)
exports.redeemCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate('business');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Check business ownership
    const business = await Business.findById(coupon.business._id);
    
    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to redeem this coupon'
      });
    }

    // Validate coupon
    if (!isCouponValid(coupon)) {
      return res.status(400).json({
        success: false,
        message: 'Coupon is expired or already redeemed'
      });
    }

    // Redeem coupon
    coupon.status = 'redeemed';
    coupon.redeemedAt = new Date();
    coupon.redeemedBy = req.user.id;
    await coupon.save();

    res.status(200).json({
      success: true,
      message: 'Coupon redeemed successfully',
      coupon
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get business coupons
// @route   GET /api/coupons/business/:businessId
// @access  Private (Business owner)
exports.getBusinessCoupons = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.businessId);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const coupons = await Coupon.find({ business: req.params.businessId })
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: coupons.length,
      coupons
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Calculate discount amount
// @route   POST /api/coupons/calculate-discount
// @access  Private
exports.calculateCouponDiscount = async (req, res, next) => {
  try {
    const { couponId, purchaseAmount } = req.body;

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    if (coupon.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'This coupon does not belong to you'
      });
    }

    if (!isCouponValid(coupon)) {
      return res.status(400).json({
        success: false,
        message: 'Coupon is expired or invalid'
      });
    }

    if (purchaseAmount < coupon.minPurchaseAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase amount is ${coupon.minPurchaseAmount}`
      });
    }

    const discount = calculateDiscount(coupon, purchaseAmount);
    const finalAmount = purchaseAmount - discount;

    res.status(200).json({
      success: true,
      discount,
      finalAmount,
      coupon
    });
  } catch (error) {
    next(error);
  }
};

