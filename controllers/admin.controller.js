const User = require('../models/User.model');
const Business = require('../models/Business.model');
const BusinessOwner = require('../models/BusinessOwner.model');
const SuspendedAccount = require('../models/SuspendedAccount.model');
const Review = require('../models/Review.model');
const Coupon = require('../models/Coupon.model');
const Notification = require('../models/Notification.model');
const { sendPushNotification, sendBulkNotifications } = require('../utils/notification');
const { sendEmail } = require('../utils/emailService');
const { generateBusinessQRCode } = require('../utils/qrcode');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
exports.getDashboardStats = async (req, res, next) => {
  try {
    // Get counts
    const totalUsers = await User.countDocuments({ role: 'customer' });
    const totalBusinesses = await Business.countDocuments();
    const activeBusinesses = await Business.countDocuments({ status: 'active' });
    const pendingBusinesses = await Business.countDocuments({ status: 'pending' });
    const totalReviews = await Review.countDocuments();
    const totalCoupons = await Coupon.countDocuments();

    // Get recent users
    const recentUsers = await User.find()
      .select('name email role status createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent businesses
    const recentBusinesses = await Business.find()
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get reviews stats
    const reviewStats = await Review.aggregate([
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    // Get monthly growth
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: lastMonth }
    });

    const newBusinessesThisMonth = await Business.countDocuments({
      createdAt: { $gte: lastMonth }
    });

    res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          newThisMonth: newUsersThisMonth
        },
        businesses: {
          total: totalBusinesses,
          active: activeBusinesses,
          pending: pendingBusinesses,
          newThisMonth: newBusinessesThisMonth
        },
        reviews: {
          total: totalReviews,
          distribution: reviewStats
        },
        coupons: {
          total: totalCoupons
        }
      },
      recentUsers,
      recentBusinesses
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
exports.getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { role, status, search } = req.query;

    const query = {};
    if (role) query.role = role;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all businesses
// @route   GET /api/admin/businesses
// @access  Private (Admin)
exports.getAllBusinesses = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, kycStatus, category, search } = req.query;

    const query = {};
    if (status) query.status = status;
    if (kycStatus) query.kycStatus = kycStatus;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const businesses = await Business.find(query)
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Business.countDocuments(query);

    res.status(200).json({
      success: true,
      count: businesses.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      businesses
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single business by ID
// @route   GET /api/admin/businesses/:id
// @access  Private (Admin)
exports.getBusinessById = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id)
      .populate('owner', 'name email phone');

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    res.status(200).json({
      success: true,
      business
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create business (Admin)
// @route   POST /api/admin/businesses
// @access  Private (Admin)
exports.createBusiness = async (req, res, next) => {
  try {
    const {
      name, ownerName, email, phone, category, description,
      address, latitude, longitude, radius,
      website, facebook, instagram, twitter,
      tripAdvisorUrl, googleBusinessName,
      openingHours, ownerId
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !category || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, phone, category, and location'
      });
    }

    // Find or require owner
    let owner;
    if (ownerId) {
      owner = await BusinessOwner.findById(ownerId);
      if (!owner) {
        return res.status(404).json({
          success: false,
          message: 'Owner not found'
        });
      }
    } else {
      // Create owner account if email provided
      if (!email || !ownerName) {
        return res.status(400).json({
          success: false,
          message: 'Owner email and name required if ownerId not provided'
        });
      }
      
      // Check if owner already exists
      owner = await BusinessOwner.findOne({ email: email.toLowerCase() });
      if (!owner) {
        // Create new owner with temporary password
        const tempPassword = Math.random().toString(36).slice(-12);
        owner = await BusinessOwner.create({
          name: ownerName,
          email: email.toLowerCase(),
          phone: phone,
          passwordHash: tempPassword, // Will be hashed by pre-save hook
          emailVerified: true, // Admin created, auto-verify
          phoneVerified: true
        });
      }
    }

    // Check if business already exists
    const existingBusiness = await Business.findOne({ owner: owner._id });
    if (existingBusiness) {
      return res.status(400).json({
        success: false,
        message: 'This owner already has a registered business'
      });
    }

    // Prepare business data
    const businessData = {
      name,
      ownerName: ownerName || owner.name,
      email,
      phone,
      category,
      description: description || '',
      owner: owner._id,
      status: req.body.status || 'pending',
      kycStatus: req.body.kycStatus || 'pending',
      radius: radius || 50,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      }
    };

    // Handle address
    if (typeof address === 'string') {
      businessData.address = { fullAddress: address };
    } else if (address) {
      businessData.address = {
        ...address,
        fullAddress: address.fullAddress || `${address.street || ''}, ${address.city || ''}, ${address.state || ''}, ${address.country || ''}`.trim()
      };
    }

    // Handle opening hours
    if (openingHours) {
      businessData.openingHours = openingHours;
    }

    // Handle social media
    if (website || facebook || instagram || twitter) {
      businessData.socialMedia = {
        website: website || '',
        facebook: facebook || '',
        instagram: instagram || '',
        twitter: twitter || ''
      };
    }

    // Handle external profiles
    if (tripAdvisorUrl || googleBusinessName) {
      businessData.externalProfiles = {
        tripAdvisor: { profileUrl: tripAdvisorUrl || '' },
        googleBusiness: { businessName: googleBusinessName || '' }
      };
    }

    // Handle logo/cover images if provided as URLs
    if (req.body.logo) {
      businessData.logo = typeof req.body.logo === 'string' 
        ? { url: req.body.logo, publicId: req.body.logoPublicId || null }
        : req.body.logo;
    }

    if (req.body.coverImage) {
      businessData.coverImage = typeof req.body.coverImage === 'string'
        ? { url: req.body.coverImage, publicId: req.body.coverImagePublicId || null }
        : req.body.coverImage;
    }

    if (req.body.images && Array.isArray(req.body.images)) {
      businessData.images = req.body.images;
    }

    const business = await Business.create(businessData);

    res.status(201).json({
      success: true,
      message: 'Business created successfully',
      business
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update business (Admin override)
// @route   PUT /api/admin/businesses/:id
// @access  Private (Admin)
exports.updateBusiness = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Admin can update any field
    const updates = {};
    const allowedFields = [
      'name', 'description', 'email', 'phone', 'category',
      'address', 'latitude', 'longitude', 'radius',
      'openingHours', 'socialMedia', 'status', 'kycStatus',
      'logo', 'coverImage', 'images', 'website', 'facebook',
      'instagram', 'twitter', 'tripAdvisorUrl', 'googleBusinessName'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'latitude' || field === 'longitude') {
          // Update location coordinates
          if (!updates.location) {
            updates.location = business.location || { type: 'Point', coordinates: [0, 0] };
          }
          if (field === 'longitude') {
            updates.location.coordinates[0] = parseFloat(req.body[field]);
          } else {
            updates.location.coordinates[1] = parseFloat(req.body[field]);
          }
        } else if (field === 'address' && typeof req.body[field] === 'string') {
          updates.address = { fullAddress: req.body[field] };
        } else {
          updates[field] = req.body[field];
        }
      }
    });

    // Handle socialMedia separately
    if (req.body.website || req.body.facebook || req.body.instagram || req.body.twitter) {
      updates.socialMedia = {
        ...(business.socialMedia || {}),
        website: req.body.website !== undefined ? req.body.website : (business.socialMedia?.website || ''),
        facebook: req.body.facebook !== undefined ? req.body.facebook : (business.socialMedia?.facebook || ''),
        instagram: req.body.instagram !== undefined ? req.body.instagram : (business.socialMedia?.instagram || ''),
        twitter: req.body.twitter !== undefined ? req.body.twitter : (business.socialMedia?.twitter || '')
      };
    }

    // Handle external profiles
    if (req.body.tripAdvisorUrl || req.body.googleBusinessName) {
      updates.externalProfiles = {
        ...(business.externalProfiles || {}),
        tripAdvisor: {
          profileUrl: req.body.tripAdvisorUrl !== undefined ? req.body.tripAdvisorUrl : (business.externalProfiles?.tripAdvisor?.profileUrl || '')
        },
        googleBusiness: {
          ...(business.externalProfiles?.googleBusiness || {}),
          businessName: req.body.googleBusinessName !== undefined ? req.body.googleBusinessName : (business.externalProfiles?.googleBusiness?.businessName || '')
        }
      };
    }

    const updatedBusiness = await Business.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('owner', 'name email phone');

    res.status(200).json({
      success: true,
      message: 'Business updated successfully',
      business: updatedBusiness
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update business radius
// @route   PUT /api/admin/businesses/:id/radius
// @access  Private (Admin)
exports.updateBusinessRadius = async (req, res, next) => {
  try {
    const { radius } = req.body;

    if (!radius || isNaN(radius) || radius < 10 || radius > 500) {
      return res.status(400).json({
        success: false,
        message: 'Radius must be a number between 10 and 500 meters'
      });
    }

    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    business.radius = parseInt(radius);
    await business.save();

    res.status(200).json({
      success: true,
      message: `Business review radius updated to ${radius}m`,
      business: {
        _id: business._id,
        name: business.name,
        radius: business.radius
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve/Reject business KYC
// @route   PUT /api/admin/businesses/:id/kyc
// @access  Private (Admin)
exports.updateBusinessKYC = async (req, res, next) => {
  try {
    const { action, reason } = req.body; // action: 'approve' or 'reject'

    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Get business owner
    const owner = await BusinessOwner.findById(business.owner);

    if (action === 'approve') {
      business.kycStatus = 'approved';
      business.status = 'active';
      business.verifiedAt = new Date();
      business.verifiedBy = req.user.id;

      // Generate QR code automatically when business is approved
      if (!business.qrCode) {
        try {
          console.log('📱 Generating QR code for approved business:', business._id);
          const qrCode = await generateBusinessQRCode(business._id.toString(), business.name);
          business.qrCode = qrCode;
          console.log('✅ QR code generated successfully');
        } catch (qrError) {
          console.error('❌ Error generating QR code:', qrError);
          // Don't fail the approval if QR generation fails
        }
      }

      // Send push notification to business owner
      await sendPushNotification(
        business.owner,
        'Business Approved! 🎉',
        `Your business "${business.name}" has been approved and is now active.`,
        { type: 'business_verification', businessId: business._id.toString() }
      );

      // Send email notification
      if (owner) {
        await sendEmail({
          to: owner.email,
          subject: 'Business Approved - You Are Now Live! 🎉',
          html: `
            <h2>Congratulations ${owner.name}!</h2>
            <p>Great news! Your business <strong>${business.name}</strong> has been approved by our admin team!</p>
            
            <p><strong>✅ What This Means:</strong></p>
            <ul>
              <li>Your business is now <strong>LIVE</strong> and visible to all HashView users</li>
              <li>Customers can now find you, read reviews, and redeem coupons</li>
              <li>You can start managing your business dashboard</li>
            </ul>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Log in to your business dashboard</li>
              <li>Update your business hours and details</li>
              <li>Create special offers and coupons for customers</li>
              <li>Start building your reputation with verified reviews</li>
            </ol>
            
            <p>Thank you for choosing HashView!</p>
            <p>Best regards,<br>HashView Team</p>
          `
        });
      }
    } else if (action === 'reject') {
      business.kycStatus = 'rejected';
      business.status = 'rejected';
      business.rejectionReason = reason || 'KYC verification failed';

      // Send push notification to business owner
      await sendPushNotification(
        business.owner,
        'Business Verification Failed',
        `Your business "${business.name}" verification was rejected. Reason: ${business.rejectionReason}`,
        { type: 'business_verification', businessId: business._id.toString() }
      );

      // Send email notification
      if (owner) {
        await sendEmail({
          to: owner.email,
          subject: 'Business Verification Status - Action Required',
          html: `
            <h2>Hi ${owner.name},</h2>
            <p>We regret to inform you that your business <strong>${business.name}</strong> could not be approved at this time.</p>
            
            <p><strong>Reason:</strong></p>
            <p style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 12px; color: #991B1B;">
              ${business.rejectionReason}
            </p>
            
            <p><strong>What You Can Do:</strong></p>
            <ol>
              <li>Review the rejection reason above</li>
              <li>Update your business information or documents</li>
              <li>Resubmit your verification request</li>
              <li>Contact our support team if you need assistance: support@hashview.com</li>
            </ol>
            
            <p>We're here to help you get verified!</p>
            <p>Best regards,<br>HashView Team</p>
          `
        });
      }
    }

    await business.save();

    res.status(200).json({
      success: true,
      message: `Business ${action}ed successfully`,
      business
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user status
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If setting status to 'suspended', create SuspendedAccount record
    if (status === 'suspended') {
      const existingSuspension = await SuspendedAccount.findOne({
        email: user.email.toLowerCase(),
        status: 'suspended'
      });

      if (!existingSuspension) {
        // Create or update suspended account record
        const unsuspendedRecord = await SuspendedAccount.findOne({
          email: user.email.toLowerCase(),
          status: 'unsuspended'
        });

        if (unsuspendedRecord) {
          unsuspendedRecord.status = 'suspended';
          unsuspendedRecord.suspendedBy = req.user.id;
          unsuspendedRecord.suspendedAt = new Date();
          unsuspendedRecord.reason = reason || 'Account suspended by admin';
          unsuspendedRecord.unsuspendedAt = null;
          unsuspendedRecord.unsuspendedBy = null;
          await unsuspendedRecord.save();
        } else {
          try {
            await SuspendedAccount.create({
              email: user.email.toLowerCase(),
              accountType: 'user',
              originalAccountId: user._id,
              suspendedBy: req.user.id,
              reason: reason || 'Account suspended by admin',
              status: 'suspended'
            });
          } catch (createError) {
            if (createError.code !== 11000) {
              throw createError;
            }
            // If unique constraint, update existing
            const existing = await SuspendedAccount.findOne({ email: user.email.toLowerCase() });
            if (existing) {
              existing.status = 'suspended';
              existing.suspendedBy = req.user.id;
              existing.suspendedAt = new Date();
              existing.reason = reason || 'Account suspended by admin';
              await existing.save();
            }
          }
        }
      }
    } else if (status === 'active') {
      // If reactivating, mark suspended account as unsuspended if exists
      const suspendedRecord = await SuspendedAccount.findOne({
        email: user.email.toLowerCase(),
        status: 'suspended'
      });

      if (suspendedRecord) {
        suspendedRecord.status = 'unsuspended';
        suspendedRecord.unsuspendedAt = new Date();
        suspendedRecord.unsuspendedBy = req.user.id;
        await suspendedRecord.save();
      }
    }

    user.status = status;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all reviews
// @route   GET /api/admin/reviews
// @access  Private (Admin)
exports.getAllReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status } = req.query;

    const query = {};
    if (status) query.status = status;

    const reviews = await Review.find(query)
      .populate('user', 'name email')
      .populate('business', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments(query);

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

// @desc    Update review status
// @route   PUT /api/admin/reviews/:id/status
// @access  Private (Admin)
exports.updateReviewStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    review.status = status;
    await review.save();

    res.status(200).json({
      success: true,
      message: 'Review status updated successfully',
      review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send push notification (ENHANCED - Full Admin Control)
// @route   POST /api/admin/notifications/send
// @access  Private (Admin)
exports.sendNotification = async (req, res, next) => {
  try {
    const { 
      title, 
      message, 
      recipientType,    // 'user', 'business', 'all_users', 'all_businesses', 'specific_user', 'specific_business'
      recipientIds,     // Array of user/business IDs (for specific recipients)
      data              // Optional data payload for the notification
    } = req.body;

    console.log('📢 Admin notification request:', { title, message, recipientType, recipientIds });

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    let sentCount = 0;
    let recipientList = [];
    
    // Load BusinessOwner model once (used in multiple cases)
    const BusinessOwner = require('../models/BusinessOwner.model');

    switch (recipientType) {
      case 'all_users':
        // Get ALL active users (not just those with push tokens)
        const allUsers = await User.find({ 
          role: 'customer',
          status: 'active'
        }).select('_id pushToken');
        
        console.log(`   📊 Found ${allUsers.length} total active users`);
        
        recipientList = allUsers.map(u => u._id);
        
        // Send push notifications to those with tokens
        const usersWithTokens = allUsers.filter(u => u.pushToken);
        console.log(`   📱 ${usersWithTokens.length} users have push tokens`);
        
        if (usersWithTokens.length > 0) {
          const userIdsWithTokens = usersWithTokens.map(u => u._id);
          await sendBulkNotifications(userIdsWithTokens, title, message, data);
          console.log(`   ✅ Push notifications sent to ${usersWithTokens.length} users`);
        }
        
        sentCount = recipientList.length;
        console.log(`   💾 Will save ${sentCount} notification records`);
        break;

      case 'all_businesses':
        // Get ALL active business owners (not just those with push tokens)
        const allBusinessOwners = await BusinessOwner.find({ 
          status: 'active'
        }).select('_id pushToken');
        
        console.log(`   📊 Found ${allBusinessOwners.length} total active business owners`);
        
        recipientList = allBusinessOwners.map(b => b._id);
        
        // Send push notifications to those with tokens
        const ownersWithTokens = allBusinessOwners.filter(o => o.pushToken);
        console.log(`   📱 ${ownersWithTokens.length} business owners have push tokens`);
        
        if (ownersWithTokens.length > 0) {
          const ownerIdsWithTokens = ownersWithTokens.map(o => o._id);
          await sendBulkNotifications(ownerIdsWithTokens, title, message, data);
          console.log(`   ✅ Push notifications sent to ${ownersWithTokens.length} business owners`);
        }
        
        sentCount = recipientList.length;
        console.log(`   💾 Will save ${sentCount} notification records`);
        break;

      case 'specific_user':
        // Send to specific user(s)
        if (!recipientIds || recipientIds.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Please provide at least one user ID'
          });
        }
        
        console.log(`   📊 Sending to ${recipientIds.length} specific user(s)`);
        
        recipientList = recipientIds;
        for (const userId of recipientIds) {
          await sendPushNotification(userId, title, message, data);
        }
        sentCount = recipientIds.length;
        console.log(`   ✅ Push notifications sent to ${sentCount} specific user(s)`);
        break;

      case 'specific_business':
        // Send to specific business owner(s)
        if (!recipientIds || recipientIds.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Please provide at least one business ID'
          });
        }
        
        console.log(`   📊 Sending to ${recipientIds.length} specific business(es)`);
        
        for (const businessId of recipientIds) {
          const business = await Business.findById(businessId).select('owner');
          if (business && business.owner) {
            await sendPushNotification(business.owner, title, message, { ...data, businessId });
            recipientList.push(business.owner);
            sentCount++;
          }
        }
        console.log(`   ✅ Push notifications sent to ${sentCount} business owner(s)`);
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid recipient type. Use: all_users, all_businesses, specific_user, or specific_business'
        });
    }

    // Save individual notification records for each recipient (for notification history)
    const allRecipients = recipientList.length > 0 ? recipientList : (recipientIds || []);
    
    console.log(`   💾 Preparing to save notifications for ${allRecipients.length} recipients`);
    
    if (allRecipients && allRecipients.length > 0) {
      let savedCount = 0;
      let failedCount = 0;
      
      const notificationPromises = allRecipients.map(async (recipientId) => {
        try {
          // Determine if recipient is User or BusinessOwner based on recipientType
          const sentToModel = (recipientType === 'all_businesses' || recipientType === 'specific_business') 
            ? 'BusinessOwner' 
            : 'User';
          
          const notification = await Notification.create({
            title,
            message,
            sentTo: recipientId,
            sentToModel,
            sentBy: req.user.id,
            type: 'admin_broadcast',
            data: data || {},
            recipientType,
            status: 'sent'
          });
          savedCount++;
          return notification;
        } catch (err) {
          failedCount++;
          console.error(`   ❌ Failed to save notification for recipient ${recipientId}:`, err.message);
          return null;
        }
      });
      
      await Promise.all(notificationPromises);
      console.log(`   ✅ Saved ${savedCount} notification records to database`);
      if (failedCount > 0) {
        console.log(`   ⚠️  Failed to save ${failedCount} notification records`);
      }
    } else {
      console.log(`   ⚠️  No recipients to save notifications for`);
    }

    res.status(200).json({
      success: true,
      message: `Notification sent successfully to ${sentCount} recipient(s)`,
      sentCount,
      recipientType,
      notification: {
        title,
        message,
        sentAt: new Date()
      }
    });
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete business
// @route   DELETE /api/admin/businesses/:id
// @access  Private (Admin)
exports.deleteBusiness = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    await business.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Business deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Suspend user account
// @route   POST /api/admin/users/:id/suspend
// @access  Private (Admin)
exports.suspendUser = async (req, res, next) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Suspension reason is required'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`🔄 Attempting to suspend user: ${user.email} (${user._id})`);

    // Check if already suspended
    const existingSuspension = await SuspendedAccount.findOne({
      email: user.email.toLowerCase(),
      status: 'suspended'
    });

    if (existingSuspension) {
      console.log(`⚠️  User ${user.email} is already suspended`);
      return res.status(400).json({
        success: false,
        message: 'This account is already suspended'
      });
    }

    // If there's an unsuspended record, update it instead of creating new
    const unsuspendedRecord = await SuspendedAccount.findOne({
      email: user.email.toLowerCase(),
      status: 'unsuspended'
    });

    let suspendedAccount;

    if (unsuspendedRecord) {
      // Update existing record
      unsuspendedRecord.status = 'suspended';
      unsuspendedRecord.suspendedBy = req.user.id;
      unsuspendedRecord.suspendedAt = new Date();
      unsuspendedRecord.reason = reason.trim();
      unsuspendedRecord.unsuspendedAt = null;
      unsuspendedRecord.unsuspendedBy = null;
      await unsuspendedRecord.save();
      suspendedAccount = unsuspendedRecord;
      console.log(`✅ Updated existing suspended record for ${user.email}`);
    } else {
      // Create new suspended account record
      try {
        suspendedAccount = await SuspendedAccount.create({
          email: user.email.toLowerCase(),
          accountType: user.role === 'admin' ? 'user' : 'user',
          originalAccountId: user._id,
          suspendedBy: req.user.id,
          reason: reason.trim(),
          status: 'suspended'
        });
        console.log(`✅ Created new suspended account record for ${user.email}: ${suspendedAccount._id}`);
      } catch (createError) {
        console.error(`❌ Error creating SuspendedAccount:`, createError);
        // If unique constraint error, try to find and update existing record
        if (createError.code === 11000) {
          const existing = await SuspendedAccount.findOne({ email: user.email.toLowerCase() });
          if (existing) {
            existing.status = 'suspended';
            existing.suspendedBy = req.user.id;
            existing.suspendedAt = new Date();
            existing.reason = reason.trim();
            await existing.save();
            suspendedAccount = existing;
            console.log(`✅ Updated existing record after unique constraint error for ${user.email}`);
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      }
    }

    // Update user status
    user.status = 'suspended';
    await user.save();
    console.log(`✅ Updated user status to suspended for ${user.email}`);

    // Send notification
    await sendPushNotification(
      user._id,
      'Account Suspended',
      `Your account has been suspended. Reason: ${reason}`,
      { type: 'account_suspension' }
    );

    res.status(200).json({
      success: true,
      message: 'User account suspended successfully',
      suspendedAccount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Suspend business account
// @route   POST /api/admin/businesses/:id/suspend
// @access  Private (Admin)
exports.suspendBusiness = async (req, res, next) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Suspension reason is required'
      });
    }

    const business = await Business.findById(req.params.id).populate('owner');

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    const owner = await BusinessOwner.findById(business.owner._id);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Business owner not found'
      });
    }

    // Check if already suspended
    const existingSuspension = await SuspendedAccount.findOne({
      email: owner.email.toLowerCase(),
      status: 'suspended'
    });

    if (existingSuspension) {
      return res.status(400).json({
        success: false,
        message: 'This account is already suspended'
      });
    }

    // Create suspended account record
    const suspendedAccount = await SuspendedAccount.create({
      email: owner.email.toLowerCase(),
      accountType: 'businessOwner',
      originalAccountId: owner._id,
      suspendedBy: req.user.id,
      reason: reason.trim(),
      status: 'suspended'
    });

    // Update business owner status
    owner.status = 'suspended';
    await owner.save();

    // Update business status
    business.status = 'suspended';
    await business.save();

    // Send notification
    await sendPushNotification(
      owner._id,
      'Business Account Suspended',
      `Your business account has been suspended. Reason: ${reason}`,
      { type: 'business_suspension', businessId: business._id.toString() }
    );

    res.status(200).json({
      success: true,
      message: 'Business account suspended successfully',
      suspendedAccount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unsuspend account
// @route   POST /api/admin/suspended/:id/unsuspend
// @access  Private (Admin)
exports.unsuspendAccount = async (req, res, next) => {
  try {
    const suspendedAccount = await SuspendedAccount.findById(req.params.id);

    if (!suspendedAccount) {
      return res.status(404).json({
        success: false,
        message: 'Suspended account record not found'
      });
    }

    if (suspendedAccount.status === 'unsuspended') {
      return res.status(400).json({
        success: false,
        message: 'This account is already unsuspended'
      });
    }

    // Update suspended account record
    suspendedAccount.status = 'unsuspended';
    suspendedAccount.unsuspendedAt = new Date();
    suspendedAccount.unsuspendedBy = req.user.id;
    await suspendedAccount.save();

    // Restore original account based on account type
    if (suspendedAccount.accountType === 'user' || suspendedAccount.accountType === 'businessOwner') {
      const UserModel = suspendedAccount.accountType === 'user' ? User : BusinessOwner;
      
      const account = await UserModel.findById(suspendedAccount.originalAccountId);
      
      if (account) {
        account.status = 'active';
        await account.save();

        // If it's a business owner, also restore the business
        if (suspendedAccount.accountType === 'businessOwner') {
          const business = await Business.findOne({ owner: account._id });
          if (business) {
            business.status = 'active';
            await business.save();
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Account unsuspended successfully',
      suspendedAccount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate QR code for business (Admin)
// @route   POST /api/admin/businesses/:id/generate-qr
// @access  Private (Admin)
exports.generateBusinessQRCode = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Generate QR code
    const qrCode = await generateBusinessQRCode(business._id.toString(), business.name);
    business.qrCode = qrCode;
    await business.save();

    res.status(200).json({
      success: true,
      message: 'QR code generated successfully',
      qrCode
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all suspended accounts
// @route   GET /api/admin/suspended
// @access  Private (Admin)
exports.getAllSuspendedAccounts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, accountType } = req.query;

    const query = {};
    if (status) query.status = status;
    if (accountType) query.accountType = accountType;

    const suspendedAccounts = await SuspendedAccount.find(query)
      .populate('suspendedBy', 'name email')
      .populate('unsuspendedBy', 'name email')
      .sort({ suspendedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SuspendedAccount.countDocuments(query);

    res.status(200).json({
      success: true,
      count: suspendedAccounts.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      suspendedAccounts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all coupons (admin)
// @route   GET /api/admin/coupons
// @access  Private (Admin)
exports.getAllCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find()
      .populate('business', 'name logo')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: coupons.length,
      data: coupons
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle coupon status (admin)
// @route   PUT /api/admin/coupons/:id/status
// @access  Private (Admin)
exports.toggleCouponStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;

    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    coupon.isActive = isActive;
    await coupon.save();

    res.status(200).json({
      success: true,
      message: `Coupon ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: coupon
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete coupon (admin)
// @route   DELETE /api/admin/coupons/:id
// @access  Private (Admin)
exports.deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
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

