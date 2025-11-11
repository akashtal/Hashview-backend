const Business = require('../models/Business.model');
const Review = require('../models/Review.model');
const { generateBusinessQRCode } = require('../utils/qrcode');
const { getNearbyQuery } = require('../utils/geolocation');
const { syncGoogleRatingsForBusiness } = require('../controllers/externalReviews.controller');
const { cloudinary } = require('../config/cloudinary');

// @desc    Create/Register new business
// @route   POST /api/business/register
// @access  Private (Business role)
exports.registerBusiness = async (req, res, next) => {
  try {
    console.log('\n📝 Business Registration Attempt');
    console.log('User ID:', req.user?.id);
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    const {
      name, ownerName, email, phone, category, description,
      address, street, area, city, state, pincode, landmark,  // Manual address fields
      latitude, longitude, radius,
      website, tripAdvisorLink, googleBusinessName, openingHours
    } = req.body;

    // Check if business already exists for this user
    const existingBusiness = await Business.findOne({ owner: req.user.id });
    if (existingBusiness) {
      return res.status(400).json({
        success: false,
        message: 'You already have a registered business'
      });
    }

    // Prepare business data
    const businessData = {
      name,
      ownerName,
      email,
      phone,
      category,
      description,
      owner: req.user.id,
      status: 'pending',
      kycStatus: 'pending',
      radius: radius || 50
    };

    // Handle address - support manual fields OR structured object OR simple string
    if (street || area || city || state || pincode || landmark) {
      // Manual address fields provided from form
      const addressParts = [];
      if (street) addressParts.push(street);
      if (area) addressParts.push(area);
      if (city) addressParts.push(city);
      if (state) addressParts.push(state);
      if (pincode) addressParts.push(pincode);
      if (landmark) addressParts.push(`Near: ${landmark}`);
      
      businessData.address = {
        street: street || '',
        area: area || '',
        city: city || '',
        state: state || '',
        pincode: pincode || '',
        zipCode: pincode || '',  // Use pincode as zipCode
        landmark: landmark || '',
        country: 'India',
        fullAddress: address || addressParts.join(', ')  // Use address if provided, otherwise combine parts
      };
    } else if (typeof address === 'string') {
      // Simple string address
      businessData.address = {
        fullAddress: address,
        country: 'India'
      };
    } else if (address && typeof address === 'object') {
      // Structured address object
      businessData.address = {
        ...address,
        pincode: address.pincode || address.zipCode,
        zipCode: address.zipCode || address.pincode,
        country: address.country || 'India',
        fullAddress: address.fullAddress || 
          `${address.street || ''}, ${address.area || ''}, ${address.city || ''}, ${address.state || ''}, ${address.pincode || address.zipCode || ''}`.replace(/, ,/g, ',').replace(/^, |, $/g, '')
      };
    } else {
      // No address provided - use empty structure
      businessData.address = {
        fullAddress: '',
        country: 'India'
      };
    }

    // Handle location - REQUIRED for geofencing feature
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Business location (latitude and longitude) is required for geofencing functionality. Please enable location services and try again.'
      });
    }
    
    businessData.location = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)]
    };

    // Handle opening hours
    if (openingHours) {
      businessData.openingHours = openingHours;
    }

    // Handle social media (only add if at least one field is provided)
    const { facebook, instagram, twitter } = req.body;
    if (website || facebook || instagram || twitter) {
      businessData.socialMedia = {
        website: website || '',
        facebook: facebook || '',
        instagram: instagram || '',
        twitter: twitter || ''
      };
    }

    // Handle external profiles (only add if provided)
    if (req.body.tripAdvisorUrl || tripAdvisorLink || googleBusinessName) {
      businessData.externalProfiles = {
        tripAdvisor: {
          profileUrl: req.body.tripAdvisorUrl || tripAdvisorLink || ''
        },
        googleBusiness: {
          businessName: googleBusinessName || ''
        }
      };
    }

    // Handle logo - can be URL from Cloudinary or file
    if (req.body.logo) {
      if (typeof req.body.logo === 'string') {
        // URL provided (from Cloudinary)
        businessData.logo = {
          url: req.body.logo,
          publicId: req.body.logoPublicId || null
        };
      } else if (req.files && req.files.logo) {
        // File uploaded via multipart/form-data
        businessData.logo = {
          url: `/uploads/${req.files.logo[0].filename}`,
          publicId: req.files.logo[0].filename
        };
      }
    }

    // Handle cover image - can be URL from Cloudinary or file
    if (req.body.coverImage) {
      if (typeof req.body.coverImage === 'string') {
        // URL provided (from Cloudinary)
        businessData.coverImage = {
          url: req.body.coverImage,
          publicId: req.body.coverImagePublicId || null
        };
      } else if (req.files && req.files.coverImage) {
        // File uploaded via multipart/form-data
        businessData.coverImage = {
          url: `/uploads/${req.files.coverImage[0].filename}`,
          publicId: req.files.coverImage[0].filename
        };
      }
    }

    // Handle business gallery images
    if (req.body.images && Array.isArray(req.body.images)) {
      businessData.images = req.body.images.map(img => {
        if (typeof img === 'string') {
          // URL provided (from Cloudinary)
          return {
            url: img,
            publicId: null
          };
        } else if (img.url) {
          // Object with url and publicId
          return {
            url: img.url,
            publicId: img.publicId || null
          };
        }
        return null;
      }).filter(img => img !== null);
    } else if (req.files && req.files.images) {
      // Files uploaded via multipart/form-data
      businessData.images = req.files.images.map(file => ({
        url: `/uploads/${file.filename}`,
        publicId: file.filename
      }));
    }

    // Create business
    console.log('Creating business with data:', JSON.stringify(businessData, null, 2));
    const business = await Business.create(businessData);
    console.log('✅ Business created successfully:', business._id);

    // Log image data to verify it's saved
    console.log('📸 Business images after creation:', {
      logo: business.logo ? '✅ Present' : '❌ Missing',
      coverImage: business.coverImage ? '✅ Present' : '❌ Missing',
      galleryCount: business.images?.length || 0,
      logoUrl: business.logo?.url?.substring(0, 50) || 'N/A',
      coverUrl: business.coverImage?.url?.substring(0, 50) || 'N/A'
    });

    // Auto-sync Google ratings in background (if Google Business name is provided)
    if (googleBusinessName && googleBusinessName.trim()) {
      console.log(`🔄 Auto-syncing Google ratings for business: ${business._id}`);
      // Call sync in background without blocking the response
      syncGoogleRatingsForBusiness(business._id.toString(), true)
        .then(result => {
          if (result.success) {
            console.log(`✅ Auto-sync completed for business: ${business._id} - Rating: ${result.data.rating}, Count: ${result.data.reviewCount}`);
          } else {
            console.log(`⚠️  Auto-sync failed for business: ${business._id} - ${result.error}`);
          }
        })
        .catch(err => {
          console.error(`❌ Auto-sync error for business: ${business._id}`, err.message);
        });
    }

    res.status(201).json({
      success: true,
      message: 'Business registered successfully. Awaiting admin approval and verification.',
      business
    });
  } catch (error) {
    console.error('❌ Business registration error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }
    
    next(error);
  }
};

// @desc    Upload business documents
// @route   POST /api/business/:id/documents
// @access  Private (Business owner)
exports.uploadDocuments = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this business'
      });
    }

    // Handle file uploads
    if (req.files) {
      if (req.files.ownerIdProof) {
        business.documents.ownerIdProof = {
          url: `/uploads/${req.files.ownerIdProof[0].filename}`,
          verified: false
        };
      }
      if (req.files.foodSafetyCertificate) {
        business.documents.foodSafetyCertificate = {
          url: `/uploads/${req.files.foodSafetyCertificate[0].filename}`,
          verified: false
        };
      }
      if (req.files.businessLicense) {
        business.documents.businessLicense = {
          url: `/uploads/${req.files.businessLicense[0].filename}`,
          verified: false
        };
      }
    }

    business.kycStatus = 'in_review';
    await business.save();

    res.status(200).json({
      success: true,
      message: 'Documents uploaded successfully',
      business
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get nearby businesses
// @route   GET /api/business/nearby
// @access  Public
exports.getNearbyBusinesses = async (req, res, next) => {
  try {
    const { latitude, longitude, radius, category, ratingSource, minRating, distance } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // Distance filter options (in meters)
    // distance can be: '1km', '5km', '10km', '25km', 'nearme', or custom radius
    let maxDistance;
    if (distance === 'nearme') {
      maxDistance = 5000; // 5km for "Near Me"
    } else if (distance === '1km') {
      maxDistance = 1000;
    } else if (distance === '5km') {
      maxDistance = 5000;
    } else if (distance === '10km') {
      maxDistance = 10000;
    } else if (distance === '25km') {
      maxDistance = 25000;
    } else {
      maxDistance = parseInt(radius) || 50000; // Default 50km
    }

    // Show only active businesses on user home page
    const query = {
      status: 'active', // Only show active businesses
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: maxDistance
        }
      }
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    // Server-side star-based rating filters
    if (ratingSource && minRating) {
      const minRatingValue = parseFloat(minRating);
      
      // Filter by specific rating source and star level
      if (ratingSource === 'hashview') {
        query['rating.average'] = { $gte: minRatingValue };
      } else if (ratingSource === 'google') {
        query['externalProfiles.googleBusiness.rating'] = { $gte: minRatingValue };
      } else if (ratingSource === 'tripadvisor') {
        query['externalProfiles.tripAdvisor.rating'] = { $gte: minRatingValue };
      }
    }

    const businesses = await Business.find(query)
      .select('-documents')
      .limit(50);

    res.status(200).json({
      success: true,
      count: businesses.length,
      businesses,
      filters: {
        ratingSource: ratingSource || null,
        minRating: minRating || null,
        category: category || null,
        distance: distance || null,
        maxDistance: `${maxDistance / 1000}km`
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all active businesses (without location filter)
// @route   GET /api/business/all
// @access  Public
exports.getAllActiveBusinesses = async (req, res, next) => {
  try {
    const { category, limit, ratingSource, minRating } = req.query;
    
    const query = { status: 'active' };
    
    if (category && category !== 'all') {
      query.category = category;
    }

    // Server-side star-based rating filters
    if (ratingSource && minRating) {
      const minRatingValue = parseFloat(minRating);
      
      // Filter by specific rating source and star level
      if (ratingSource === 'hashview') {
        query['rating.average'] = { $gte: minRatingValue };
      } else if (ratingSource === 'google') {
        query['externalProfiles.googleBusiness.rating'] = { $gte: minRatingValue };
      } else if (ratingSource === 'tripadvisor') {
        query['externalProfiles.tripAdvisor.rating'] = { $gte: minRatingValue };
      }
    }

    const businesses = await Business.find(query)
      .select('-documents')
      .limit(parseInt(limit) || 100)
      .sort({ 'rating.average': -1 }); // Sort by highest rated first

    res.status(200).json({
      success: true,
      count: businesses.length,
      businesses,
      filters: {
        ratingSource: ratingSource || null,
        minRating: minRating || null,
        category: category || null
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search businesses
// @route   GET /api/business/search
// @access  Public
exports.searchBusinesses = async (req, res, next) => {
  try {
    const { query, category, city, ratingSource, minRating } = req.query;
    
    // Show only active businesses for user search
    const searchQuery = { status: 'active' };

    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ];
    }

    if (category && category !== 'all') {
      searchQuery.category = category;
    }

    if (city) {
      searchQuery['address.city'] = { $regex: city, $options: 'i' };
    }

    // Server-side star-based rating filters
    if (ratingSource && minRating) {
      const minRatingValue = parseFloat(minRating);
      
      // Filter by specific rating source and star level
      if (ratingSource === 'hashview') {
        searchQuery['rating.average'] = { $gte: minRatingValue };
      } else if (ratingSource === 'google') {
        searchQuery['externalProfiles.googleBusiness.rating'] = { $gte: minRatingValue };
      } else if (ratingSource === 'tripadvisor') {
        searchQuery['externalProfiles.tripAdvisor.rating'] = { $gte: minRatingValue };
      }
    }

    const businesses = await Business.find(searchQuery)
      .select('-documents')
      .sort({ 'rating.average': -1 }) // Sort by highest rated first
      .limit(50);

    res.status(200).json({
      success: true,
      count: businesses.length,
      businesses,
      filters: {
        ratingSource: ratingSource || null,
        minRating: minRating || null,
        category: category || null
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single business
// @route   GET /api/business/:id
// @access  Public
exports.getBusiness = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id)
      .populate('owner', 'name email')
      .select('-documents');

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

// @desc    Get business dashboard data
// @route   GET /api/business/:id/dashboard
// @access  Private (Business owner)
exports.getBusinessDashboard = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id);

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

    // Get reviews
    const reviews = await Review.find({ business: business._id })
      .populate('user', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get analytics
    const totalReviews = await Review.countDocuments({ business: business._id });
    const avgRating = await Review.aggregate([
      { $match: { business: business._id } },
      { $group: { _id: null, avg: { $avg: '$rating' } } }
    ]);

    // Get reviews by rating
    const ratingDistribution = await Review.aggregate([
      { $match: { business: business._id } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    res.status(200).json({
      success: true,
      dashboard: {
        business,
        recentReviews: reviews,
        analytics: {
          totalReviews,
          averageRating: avgRating[0]?.avg || 0,
          ratingDistribution
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate QR code for business
// @route   POST /api/business/:id/generate-qr
// @access  Private (Business owner)
exports.generateQRCode = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
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

// @desc    Get business by QR code data (Public endpoint for mobile app)
// @route   POST /api/business/qr/scan
// @access  Public
exports.getBusinessByQRCode = async (req, res, next) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({
        success: false,
        message: 'QR code data is required'
      });
    }

    const { parseQRCodeData } = require('../utils/qrcode');
    
    // Parse QR code data
    const parsed = parseQRCodeData(qrData);
    
    if (!parsed.valid || !parsed.businessId) {
      return res.status(400).json({
        success: false,
        message: parsed.error || 'Invalid QR code'
      });
    }

    // Find business by ID
    const business = await Business.findById(parsed.businessId)
      .populate('owner', 'name email phone')
      .select('-qrCode'); // Don't send QR code back to mobile

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Only return active businesses
    if (business.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'This business is not active'
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

// @desc    Update business images (logo, cover, gallery)
// @route   PUT /api/business/:id/images
// @access  Private (Business owner)
exports.updateBusinessImages = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Verify ownership
    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this business'
      });
    }

    const updateData = {};

    // Update logo
    if (req.body.logo) {
      // Delete old logo if exists
      if (business.logo?.publicId) {
        try {
          await cloudinary.uploader.destroy(business.logo.publicId);
        } catch (err) {
          console.error('Error deleting old logo:', err);
        }
      }

      if (typeof req.body.logo === 'string') {
        updateData.logo = {
          url: req.body.logo,
          publicId: req.body.logoPublicId || null
        };
      }
    }

    // Update cover image
    if (req.body.coverImage) {
      // Delete old cover if exists
      if (business.coverImage?.publicId) {
        try {
          await cloudinary.uploader.destroy(business.coverImage.publicId);
        } catch (err) {
          console.error('Error deleting old cover:', err);
        }
      }

      if (typeof req.body.coverImage === 'string') {
        updateData.coverImage = {
          url: req.body.coverImage,
          publicId: req.body.coverImagePublicId || null
        };
      }
    }

    // Update gallery images
    if (req.body.images !== undefined) {
      // Delete old gallery images
      if (business.images && business.images.length > 0) {
        for (const img of business.images) {
          if (img.publicId) {
            try {
              await cloudinary.uploader.destroy(img.publicId);
            } catch (err) {
              console.error('Error deleting old gallery image:', err);
            }
          }
        }
      }

      if (Array.isArray(req.body.images)) {
        updateData.images = req.body.images.map(img => {
          if (typeof img === 'string') {
            return {
              url: img,
              publicId: null
            };
          } else if (img.url) {
            return {
              url: img.url,
              publicId: img.publicId || null
            };
          }
          return null;
        }).filter(img => img !== null);
      } else {
        updateData.images = [];
      }
    }

    // Update business
    Object.assign(business, updateData);
    await business.save();

    // Refresh business data to ensure all fields are populated
    const updatedBusiness = await Business.findById(req.params.id)
      .populate('owner', 'name email')
      .lean();

    console.log('✅ Business images updated in database:', {
      businessId: business._id,
      logo: updatedBusiness.logo ? 'present' : 'missing',
      coverImage: updatedBusiness.coverImage ? 'present' : 'missing',
      galleryCount: updatedBusiness.images?.length || 0
    });

    res.status(200).json({
      success: true,
      message: 'Business images updated successfully',
      business: updatedBusiness
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update business
// @route   PUT /api/business/:id
// @access  Private (Business owner)
exports.updateBusiness = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const allowedUpdates = ['name', 'description', 'email', 'phone', 'address', 'category', 'openingHours', 'socialMedia', 'website'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Handle address if provided as string
    if (req.body.address && typeof req.body.address === 'string') {
      updates.address = {
        fullAddress: req.body.address
      };
    } else if (req.body.address && typeof req.body.address === 'object') {
      updates.address = req.body.address;
    }

    // Handle socialMedia website separately
    if (req.body.website !== undefined) {
      if (!updates.socialMedia) {
        updates.socialMedia = business.socialMedia || {};
      }
      updates.socialMedia.website = req.body.website;
    }

    const updatedBusiness = await Business.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Business updated successfully',
      business: updatedBusiness
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my businesses
// @route   GET /api/business/my/businesses
// @access  Private (Business owner)
exports.getMyBusinesses = async (req, res, next) => {
  try {
    const businesses = await Business.find({ owner: req.user.id });

    res.status(200).json({
      success: true,
      count: businesses.length,
      businesses
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually update TripAdvisor rating and review count
// @route   PUT /api/business/:id/tripadvisor-rating
// @access  Private (Business owner, Admin)
exports.updateTripAdvisorRating = async (req, res, next) => {
  try {
    const { rating, reviewCount, profileUrl } = req.body;

    // Validation
    if (rating !== undefined && rating !== null && (rating < 0 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 0 and 5'
      });
    }

    if (reviewCount !== undefined && reviewCount !== null && reviewCount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Review count must be a positive number'
      });
    }

    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Authorization check - must be business owner or admin
    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this business'
      });
    }

    // Update TripAdvisor rating
    if (!business.externalProfiles) {
      business.externalProfiles = {};
    }
    if (!business.externalProfiles.tripAdvisor) {
      business.externalProfiles.tripAdvisor = {};
    }

    if (rating !== undefined && rating !== null) {
      business.externalProfiles.tripAdvisor.rating = parseFloat(rating);
    }
    if (reviewCount !== undefined && reviewCount !== null) {
      business.externalProfiles.tripAdvisor.reviewCount = parseInt(reviewCount);
    }
    if (profileUrl !== undefined && profileUrl !== null) {
      business.externalProfiles.tripAdvisor.profileUrl = profileUrl;
    }
    business.externalProfiles.tripAdvisor.lastSynced = new Date();

    await business.save();

    res.status(200).json({
      success: true,
      message: 'TripAdvisor rating updated successfully',
      data: {
        rating: business.externalProfiles.tripAdvisor.rating,
        reviewCount: business.externalProfiles.tripAdvisor.reviewCount,
        profileUrl: business.externalProfiles.tripAdvisor.profileUrl,
        lastSynced: business.externalProfiles.tripAdvisor.lastSynced
      }
    });
  } catch (error) {
    next(error);
  }
};

