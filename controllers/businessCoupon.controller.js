const Coupon = require('../models/Coupon.model');
const Business = require('../models/Business.model');

// @desc    Get all coupons for a business
// @route   GET /api/business-coupons/business/:businessId
// @access  Private (Business owner, Admin)
exports.getBusinessCoupons = async (req, res, next) => {
  try {
    const { businessId } = req.params;

    // Check authorization
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these coupons'
      });
    }

    const coupons = await Coupon.find({ business: businessId, type: 'business' })
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

// @desc    Get single coupon
// @route   GET /api/business-coupons/:id
// @access  Private
exports.getCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate('business', 'name');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
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

// @desc    Create new coupon
// @route   POST /api/business-coupons
// @access  Private (Business owner)
exports.createCoupon = async (req, res, next) => {
  try {
    const {
      businessId,
      code,
      title,
      description,
      discountType,
      discountValue,
      itemName,
      minPurchaseAmount,
      maxDiscountAmount,
      validFrom,
      validUntil,
      usageLimit,
      redemptionLimit, // How many users can redeem coupons from this template
      terms
    } = req.body;

    // Check authorization
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create coupons for this business'
      });
    }

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({ 
      code: code.toUpperCase() 
    });
    
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists. Please choose a different code.'
      });
    }

    // Create coupon
    const coupon = await Coupon.create({
      type: 'business',
      business: businessId,
      code: code.toUpperCase(),
      title,
      description,
      rewardType: discountType,
      rewardValue: discountValue,
      itemName: itemName || null,
      minPurchaseAmount: minPurchaseAmount || 0,
      maxDiscountAmount: maxDiscountAmount || null,
      validFrom: validFrom || Date.now(),
      validUntil: validUntil || null,
      usageLimit: usageLimit || null,
      redemptionLimit: redemptionLimit || null, // How many users can redeem
      redemptionCount: 0, // Start with 0 redemptions
      terms: terms || ''
    });

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }
    next(error);
  }
};

// @desc    Update coupon
// @route   PUT /api/business-coupons/:id
// @access  Private (Business owner)
exports.updateCoupon = async (req, res, next) => {
  try {
    let coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Check authorization
    const business = await Business.findById(coupon.business);
    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this coupon'
      });
    }

    // If updating code, check if new code already exists
    if (req.body.code && req.body.code.toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ 
        code: req.body.code.toUpperCase(),
        _id: { $ne: coupon._id }
      });
      
      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: 'Coupon code already exists. Please choose a different code.'
        });
      }
      req.body.code = req.body.code.toUpperCase();
    }

    coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete coupon
// @route   DELETE /api/business-coupons/:id
// @access  Private (Business owner)
exports.deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Check authorization
    const business = await Business.findById(coupon.business);
    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this coupon'
      });
    }

    await coupon.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle coupon active status
// @route   PATCH /api/business-coupons/:id/toggle-status
// @access  Private (Business owner)
exports.toggleCouponStatus = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Check authorization
    const business = await Business.findById(coupon.business);
    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this coupon'
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      coupon
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify coupon code (for customers)
// @route   POST /api/business-coupons/verify
// @access  Public
exports.verifyCouponCode = async (req, res, next) => {
  try {
    const { code, businessId } = req.body;

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      business: businessId,
      type: 'business'
    }).populate('business', 'name');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    if (!coupon.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon is not valid or has expired'
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

// @desc    Scan and redeem coupon QR code
// @route   POST /api/business-coupons/scan-redeem
// @access  Private (Business owner)
exports.scanAndRedeemCoupon = async (req, res, next) => {
  try {
    const { qrCodeData } = req.body; // QR code data as JSON string

    if (!qrCodeData) {
      return res.status(400).json({
        success: false,
        message: 'QR code data is required'
      });
    }

    // Parse QR code data
    let parsedData;
    try {
      parsedData = typeof qrCodeData === 'string' ? JSON.parse(qrCodeData) : qrCodeData;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }

    // Validate QR code structure
    if (parsedData.type !== 'coupon' || !parsedData.couponId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coupon QR code'
      });
    }

    // Find the coupon
    const coupon = await Coupon.findById(parsedData.couponId)
      .populate('business', 'name owner')
      .populate('user', 'name email phone');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Check authorization - business owner must own the business
    if (coupon.business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to redeem this coupon'
      });
    }

    // Check if coupon is already redeemed
    if (coupon.status === 'redeemed') {
      return res.status(400).json({
        success: false,
        message: 'This coupon has already been redeemed',
        coupon: {
          _id: coupon._id,
          code: coupon.code,
          status: coupon.status,
          redeemedAt: coupon.redeemedAt,
          user: coupon.user
        }
      });
    }

    // Check if coupon is expired
    if (coupon.status === 'expired' || (coupon.validUntil && new Date() > coupon.validUntil)) {
      // Auto-expire if not already expired
      if (coupon.status !== 'expired') {
        coupon.status = 'expired';
        await coupon.save();
      }
      return res.status(400).json({
        success: false,
        message: 'This coupon has expired',
        coupon: {
          _id: coupon._id,
          code: coupon.code,
          status: coupon.status,
          validUntil: coupon.validUntil
        }
      });
    }

    // Check if coupon is valid
    if (!coupon.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'This coupon is not valid',
        coupon: {
          _id: coupon._id,
          code: coupon.code,
          status: coupon.status
        }
      });
    }

    // Redeem the coupon
    coupon.status = 'redeemed';
    coupon.redeemedAt = new Date();
    coupon.redeemedBy = req.user.id;
    await coupon.save();

    // Update template redemption count if this is a review_reward coupon
    if (coupon.type === 'review_reward') {
      const couponTemplate = await Coupon.findOne({
        business: coupon.business._id,
        type: 'business',
        isActive: true
      });

      if (couponTemplate) {
        await Coupon.findByIdAndUpdate(couponTemplate._id, {
          $inc: { redemptionCount: 1 }
        });
      }
    }

    // Send notification to user
    const { sendPushNotification } = require('../utils/notification');
    if (coupon.user) {
      await sendPushNotification(
        coupon.user._id,
        'Coupon Redeemed! ✅',
        `Your coupon from ${coupon.business.name} has been successfully redeemed.`,
        { type: 'coupon_redeemed', couponId: coupon._id.toString() }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Coupon redeemed successfully',
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        status: coupon.status,
        redeemedAt: coupon.redeemedAt,
        user: coupon.user,
        business: coupon.business
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get coupon redemption statistics for a business
// @route   GET /api/business-coupons/redemption-stats/:businessId
// @access  Private (Business owner)
exports.getRedemptionStats = async (req, res, next) => {
  try {
    const { businessId } = req.params;

    // Check authorization
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these statistics'
      });
    }

    // Get coupon template
    const couponTemplate = await Coupon.findOne({
      business: businessId,
      type: 'business',
      isActive: true
    });

    // Count coupons by status
    const totalIssued = await Coupon.countDocuments({
      business: businessId,
      type: 'review_reward'
    });

    const redeemedCount = await Coupon.countDocuments({
      business: businessId,
      type: 'review_reward',
      status: 'redeemed'
    });

    const expiredCount = await Coupon.countDocuments({
      business: businessId,
      type: 'review_reward',
      status: 'expired'
    });

    const activeCount = await Coupon.countDocuments({
      business: businessId,
      type: 'review_reward',
      status: 'active',
      validUntil: { $gt: new Date() }
    });

    // Get recently redeemed coupons
    const recentlyRedeemed = await Coupon.find({
      business: businessId,
      type: 'review_reward',
      status: 'redeemed'
    })
      .populate('user', 'name email phone')
      .sort({ redeemedAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      stats: {
        template: couponTemplate ? {
          redemptionLimit: couponTemplate.redemptionLimit,
          redemptionCount: couponTemplate.redemptionCount || 0
        } : null,
        totalIssued,
        redeemed: redeemedCount,
        expired: expiredCount,
        active: activeCount,
        recentlyRedeemed
      }
    });
  } catch (error) {
    next(error);
  }
};
