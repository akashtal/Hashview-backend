const User = require('../models/User.model');
const Review = require('../models/Review.model');
const Coupon = require('../models/Coupon.model');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res, next) => {
  try {
    // req.user is already populated by auth middleware from correct collection
    const user = req.user;

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        status: user.status,
        createdAt: user.createdAt,
        ...(user.role === 'business' && { businesses: user.businesses }),
        ...(user.role === 'customer' && { location: user.location })
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, location } = req.body;

    // req.user is already populated by auth middleware
    const user = req.user;

    if (name) user.name = name;
    if (phone) user.phone = phone;
    
    // Only update location for customers (User collection has location field)
    if (location && user.role === 'customer') {
      user.location = {
        type: 'Point',
        coordinates: [location.longitude, location.latitude],
        address: location.address
      };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        status: user.status,
        createdAt: user.createdAt,
        ...(user.role === 'business' && { businesses: user.businesses }),
        ...(user.role === 'customer' && { location: user.location })
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user reviews
// @route   GET /api/users/reviews
// @access  Private
exports.getUserReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ user: req.user.id })
      .populate('business', 'name logo category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments({ user: req.user.id });

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

// @desc    Get user coupons
// @route   GET /api/users/coupons
// @access  Private
exports.getUserCoupons = async (req, res, next) => {
  try {
    const { status } = req.query;
    
    const query = { user: req.user.id };
    if (status) query.status = status;
    
    // CRITICAL FIX: Only return non-expired coupons
    query.validUntil = { $gte: new Date() };

    const coupons = await Coupon.find(query)
      .populate('business', 'name logo address phone email category')
      .sort({ createdAt: -1 });
    
    // Ensure qrCodeData is included for all coupons
    for (const coupon of coupons) {
      if (!coupon.qrCodeData && coupon._id) {
        // Generate QR code data if missing
        const qrCodeData = JSON.stringify({
          type: 'coupon',
          couponId: coupon._id.toString(),
          code: coupon.code,
          businessId: coupon.business?._id?.toString() || '',
          userId: coupon.user?.toString() || '',
          timestamp: new Date().toISOString()
        });
        coupon.qrCodeData = qrCodeData;
        // Optionally save it to database
        await Coupon.findByIdAndUpdate(coupon._id, { qrCodeData });
      }
    }

    res.status(200).json({
      success: true,
      count: coupons.length,
      coupons
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user reward history
// @route   GET /api/users/rewards
// @access  Private
exports.getRewardHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const coupons = await Coupon.find({ user: req.user.id })
      .populate('business', 'name logo address phone email category')
      .populate('review', 'rating comment')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Ensure qrCodeData is included for all coupons
    for (const coupon of coupons) {
      if (!coupon.qrCodeData && coupon._id) {
        // Generate QR code data if missing
        const qrCodeData = JSON.stringify({
          type: 'coupon',
          couponId: coupon._id.toString(),
          code: coupon.code,
          businessId: coupon.business?._id?.toString() || '',
          userId: coupon.user?.toString() || '',
          timestamp: new Date().toISOString()
        });
        coupon.qrCodeData = qrCodeData;
        // Optionally save it to database
        await Coupon.findByIdAndUpdate(coupon._id, { qrCodeData });
      }
    }

    const total = await Coupon.countDocuments({ user: req.user.id });

    res.status(200).json({
      success: true,
      count: coupons.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      rewards: coupons
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload profile image
// @route   POST /api/users/upload-image
// @access  Private
exports.uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image'
      });
    }

    // When using CloudinaryStorage, req.file.path contains the full Cloudinary URL
    const cloudinaryUrl = req.file.path;
    const publicId = req.file.filename;

    // Update user profile image
    const user = req.user;
    user.profileImage = cloudinaryUrl; // Use full Cloudinary URL, not local path
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      url: cloudinaryUrl,
      publicId: publicId
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
exports.deleteAccount = async (req, res, next) => {
  try {
    // req.user is already populated by auth middleware
    const user = req.user;
    user.status = 'inactive';
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   POST /api/users/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current password and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Get user with password field (normally excluded)
    const User = require('../models/User.model');
    const user = await User.findById(req.user.id).select('+passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password (pre-save hook will hash it)
    user.passwordHash = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update account settings
// @route   PUT /api/user/account-settings
// @access  Private
exports.updateAccountSettings = async (req, res, next) => {
  try {
    const updates = req.body;
    
    // Find user (check both User and BusinessOwner models)
    let user = await User.findById(req.user.id);
    if (!user) {
      user = await BusinessOwner.findById(req.user.id);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize settings if not exists
    if (!user.settings) {
      user.settings = {};
    }

    // Update allowed settings
    const allowedSettings = [
      'twoFactorAuth', 'loginAlerts', 'dataSharing', 
      'marketingEmails', 'pushNotifications', 'emailNotifications'
    ];

    Object.keys(updates).forEach(key => {
      if (allowedSettings.includes(key)) {
        user.settings[key] = updates[key];
      }
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      settings: user.settings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export user data
// @route   POST /api/user/export-data
// @access  Private
exports.exportUserData = async (req, res, next) => {
  try {
    const { sendEmail } = require('../utils/emailService');
    const Review = require('../models/Review.model');

    // Find user (check both models)
    let user = await User.findById(req.user.id).select('-passwordHash');
    let isBusinessOwner = false;
    
    if (!user) {
      user = await BusinessOwner.findById(req.user.id).select('-passwordHash').populate('businesses');
      isBusinessOwner = true;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Gather user data
    const userData = {
      profile: user.toObject(),
      reviews: [],
      coupons: []
    };

    // Get user's reviews if customer
    if (!isBusinessOwner) {
      userData.reviews = await Review.find({ user: req.user.id });
    }

    // Get user's coupons if customer
    if (!isBusinessOwner) {
      const Coupon = require('../models/Coupon.model');
      userData.coupons = await Coupon.find({ user: req.user.id });
    }

    // Send email with data
    try {
      await sendEmail({
        to: user.email,
        subject: 'Your HashView Personal Data Export',
        html: `
          <h2>Personal Data Export</h2>
          <p>Hi ${user.name},</p>
          <p>As requested, here is your personal data:</p>
          <pre>${JSON.stringify(userData, null, 2)}</pre>
          <p>This data includes your profile information, reviews, and coupons.</p>
          <p>If you have any questions, please contact our support team.</p>
          <p>Best regards,<br/>HashView Team</p>
        `
      });

      res.status(200).json({
        success: true,
        message: 'Data export sent to your email'
      });
    } catch (emailError) {
      console.error('Failed to send data export email:', emailError);
      res.status(500).json({
        success: false,
        message: 'Failed to send data export email'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate account
// @route   PUT /api/user/deactivate
// @access  Private
exports.deactivateAccount = async (req, res, next) => {
  try {
    // Find user (check both models)
    let user = await User.findById(req.user.id);
    let isBusinessOwner = false;
    
    if (!user) {
      user = await BusinessOwner.findById(req.user.id);
      isBusinessOwner = true;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update status to inactive
    user.status = 'inactive';
    await user.save();

    // If business owner, deactivate all their businesses
    if (isBusinessOwner && user.businesses) {
      const Business = require('../models/Business.model');
      await Business.updateMany(
        { _id: { $in: user.businesses } },
        { status: 'inactive' }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete account permanently
// @route   DELETE /api/user/account
// @access  Private
exports.deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete account'
      });
    }

    // Find user (check both models)
    let user = await User.findById(req.user.id);
    let isBusinessOwner = false;
    
    if (!user) {
      user = await BusinessOwner.findById(req.user.id);
      isBusinessOwner = true;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    // If business owner, delete all their businesses first
    if (isBusinessOwner && user.businesses && user.businesses.length > 0) {
      const Business = require('../models/Business.model');
      await Business.deleteMany({ _id: { $in: user.businesses } });
    }

    // Delete user's reviews if customer
    if (!isBusinessOwner) {
      const Review = require('../models/Review.model');
      await Review.deleteMany({ user: req.user.id });
    }

    // Delete user's coupons
    const Coupon = require('../models/Coupon.model');
    await Coupon.deleteMany({ user: req.user.id });

    // Delete user's support tickets
    const SupportTicket = require('../models/SupportTicket.model');
    await SupportTicket.deleteMany({ user: req.user.id });

    // Delete the user
    if (isBusinessOwner) {
      await BusinessOwner.findByIdAndDelete(req.user.id);
    } else {
      await User.findByIdAndDelete(req.user.id);
    }

    res.status(200).json({
      success: true,
      message: 'Account deleted permanently'
    });
  } catch (error) {
    next(error);
  }
};

