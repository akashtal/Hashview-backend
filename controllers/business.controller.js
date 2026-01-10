const Business = require('../models/Business.model');
const Review = require('../models/Review.model');
const { generateBusinessQRCode } = require('../utils/qrcode');
const { getNearbyQuery, calculateDistance } = require('../utils/geolocation');
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
      address, buildingNumber, street, area, city, county, state, postcode, pincode, country, landmark,  // UK & International address fields
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
      kycStatus: 'approved',
      radius: radius || 50
    };

    // Handle address - support UK & International formats
    if (buildingNumber || street || area || city || county || state || postcode || pincode || landmark) {
      // Manual address fields provided from form (UK or International)
      const addressParts = [];
      if (buildingNumber) addressParts.push(buildingNumber);
      if (street) addressParts.push(street);
      if (area) addressParts.push(area);
      if (city) addressParts.push(city);
      if (county) addressParts.push(county);
      if (state) addressParts.push(state);
      if (postcode) addressParts.push(postcode);
      if (pincode) addressParts.push(pincode);
      if (landmark) addressParts.push(`Near: ${landmark}`);

      businessData.address = {
        buildingNumber: buildingNumber || '',
        street: street || '',
        area: area || '',
        city: city || '',
        county: county || '',
        state: state || '',
        postcode: postcode || '',
        zipCode: postcode || pincode || '',  // Use postcode or pincode as zipCode
        pincode: pincode || '',
        landmark: landmark || '',
        country: country || 'United Kingdom',
        fullAddress: address || addressParts.join(', ')  // Use address if provided, otherwise combine parts
      };
    } else if (typeof address === 'string') {
      // Simple string address
      businessData.address = {
        fullAddress: address,
        country: country || 'United Kingdom'
      };
    } else if (address && typeof address === 'object') {
      // Structured address object
      businessData.address = {
        ...address,
        buildingNumber: address.buildingNumber || '',
        county: address.county || '',
        postcode: address.postcode || address.zipCode || '',
        pincode: address.pincode || '',
        zipCode: address.zipCode || address.postcode || address.pincode || '',
        country: address.country || country || 'United Kingdom',
        fullAddress: address.fullAddress ||
          `${address.buildingNumber || ''} ${address.street || ''}, ${address.city || ''}, ${address.county || ''}, ${address.postcode || address.zipCode || ''}`.replace(/\s+/g, ' ').replace(/, ,/g, ',').replace(/^, |, $/g, '').trim()
      };
    } else {
      // No address provided - use empty structure
      businessData.address = {
        fullAddress: '',
        country: country || 'United Kingdom'
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
    const { latitude, longitude, radius, category, ratingSource, minRating, distance, search, query: legacyQuery } = req.query;

    console.log('🌍 getNearbyBusinesses request:', {
      latitude,
      longitude,
      distance,
      radius,
      ratingSource,
      minRating,
      category,
      search: search || legacyQuery
    });

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
      maxDistance = 2000; // 2km for "Near Me" - truly nearby businesses
      console.log('   📍 Distance filter: Near Me (2km)');
    } else if (distance === '1km') {
      maxDistance = 1000;
      console.log('   📍 Distance filter: 1km');
    } else if (distance === '5km') {
      maxDistance = 5000;
      console.log('   📍 Distance filter: 5km');
    } else if (distance === '10km') {
      maxDistance = 10000;
      console.log('   📍 Distance filter: 10km');
    } else if (distance === '25km') {
      maxDistance = 25000;
      console.log('   📍 Distance filter: 25km');
    } else {
      maxDistance = parseInt(radius) || 50000; // Default 50km
      console.log(`   📍 Distance filter: Default (${maxDistance / 1000}km)`);
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

    // Search query (backend handles case-insensitive search)
    const searchTerm = search || legacyQuery;
    if (searchTerm && searchTerm.trim() !== '') {
      query.$or = [
        { name: { $regex: searchTerm.trim(), $options: 'i' } },
        { description: { $regex: searchTerm.trim(), $options: 'i' } },
        { 'address.fullAddress': { $regex: searchTerm.trim(), $options: 'i' } },
        { 'address.city': { $regex: searchTerm.trim(), $options: 'i' } },
        { 'address.area': { $regex: searchTerm.trim(), $options: 'i' } },
        { 'address.state': { $regex: searchTerm.trim(), $options: 'i' } }
      ];
    }

    if (category && category !== 'all') {
      const trimmedCategory = category.trim();
      query.category = {
        $regex: new RegExp(`^${escapeRegExp(trimmedCategory)}$`, 'i')
      };
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

    console.log(`   🔍 Executing MongoDB $near query with maxDistance: ${maxDistance}m`);
    const businesses = await Business.find(query)
      .select('-documents')
      .limit(50);

    console.log(`   📊 MongoDB returned ${businesses.length} businesses`);

    // Calculate distance for each business and add to response
    const businessesWithDistance = businesses.map((business, index) => {
      const businessObj = business.toObject();
      if (business.location && business.location.coordinates) {
        const distanceInMeters = calculateDistance(
          parseFloat(latitude),
          parseFloat(longitude),
          business.location.coordinates[1], // latitude
          business.location.coordinates[0]  // longitude
        );
        const distanceInKm = distanceInMeters / 1000;
        businessObj.distance = distanceInKm; // Convert to KM for frontend

        // Log first 3 businesses
        if (index < 3) {
          console.log(`      ${index + 1}. ${business.name}: ${distanceInKm.toFixed(2)}km (${distanceInMeters.toFixed(0)}m)`);
        }
      }
      return businessObj;
    });

    console.log(`   ✅ Found ${businessesWithDistance.length} businesses within ${maxDistance / 1000}km`);
    if (businessesWithDistance.length > 0) {
      const distances = businessesWithDistance.map(b => b.distance).filter(d => d !== undefined);
      if (distances.length > 0) {
        console.log(`   📊 Distance range: ${Math.min(...distances).toFixed(2)}km - ${Math.max(...distances).toFixed(2)}km`);
      }
    }

    res.status(200).json({
      success: true,
      count: businessesWithDistance.length,
      businesses: businessesWithDistance,
      filters: {
        ratingSource: ratingSource || null,
        minRating: minRating || null,
        category: category || null,
        distance: distance || null,
        maxDistance: `${maxDistance / 1000}km`
      }
    });
  } catch (error) {
    console.error('❌ getNearbyBusinesses error:', error);
    next(error);
  }
};

// @desc    Get all active businesses (without location filter)
// @route   GET /api/business/all
// @access  Public
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

exports.getAllActiveBusinesses = async (req, res, next) => {
  try {
    const { category, limit, ratingSource, minRating, search, query: legacyQuery } = req.query;

    console.log('📋 getAllActiveBusinesses request:', { category, ratingSource, minRating, limit, search: search || legacyQuery });

    const query = { status: 'active' };

    // Search query (backend handles case-insensitive search)
    const searchTerm = search || legacyQuery;
    if (searchTerm && searchTerm.trim() !== '') {
      query.$or = [
        { name: { $regex: searchTerm.trim(), $options: 'i' } },
        { description: { $regex: searchTerm.trim(), $options: 'i' } },
        { 'address.fullAddress': { $regex: searchTerm.trim(), $options: 'i' } },
        { 'address.city': { $regex: searchTerm.trim(), $options: 'i' } },
        { 'address.area': { $regex: searchTerm.trim(), $options: 'i' } },
        { 'address.state': { $regex: searchTerm.trim(), $options: 'i' } }
      ];
    }

    if (category && category !== 'all') {
      const trimmedCategory = category.trim();
      query.category = {
        $regex: new RegExp(`^${escapeRegExp(trimmedCategory)}$`, 'i')
      };
    }

    // Server-side star-based rating filters
    if (ratingSource && minRating) {
      const minRatingValue = parseFloat(minRating);

      console.log(`   🎯 Applying ${ratingSource} rating filter: ≥${minRatingValue} stars`);

      // Filter by specific rating source and star level
      if (ratingSource === 'hashview') {
        query['rating.average'] = { $gte: minRatingValue };
      } else if (ratingSource === 'google') {
        query['externalProfiles.googleBusiness.rating'] = { $gte: minRatingValue };
      } else if (ratingSource === 'tripadvisor') {
        query['externalProfiles.tripAdvisor.rating'] = { $gte: minRatingValue };
      }
    }

    console.log('   📊 MongoDB query:', JSON.stringify(query, null, 2));

    const businesses = await Business.find(query)
      .select('-documents')
      .limit(parseInt(limit) || 100)
      .sort({ 'rating.average': -1 }); // Sort by highest rated first

    console.log(`   ✅ Found ${businesses.length} businesses`);
    businesses.forEach((b, i) => {
      console.log(`      ${i + 1}. ${b.name} - Google: ${b.externalProfiles?.googleBusiness?.rating || 'N/A'}, HashView: ${b.rating?.average || 0}`);
    });

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
    const {
      search,        // Real-time search query
      query,         // Legacy query param (for backward compatibility)
      category,
      city,
      ratingSource,
      minRating,
      latitude,      // User's location for distance sorting
      longitude,
      limit          // Limit results (for autocomplete)
    } = req.query;

    console.log('🔍 Search request:', { search, query, latitude, longitude, limit });

    // Show only active businesses for user search
    const searchQuery = { status: 'active' };

    // Real-time search by name or location
    const searchTerm = search || query;
    if (searchTerm) {
      searchQuery.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { 'address.fullAddress': { $regex: searchTerm, $options: 'i' } },
        { 'address.city': { $regex: searchTerm, $options: 'i' } },
        { 'address.area': { $regex: searchTerm, $options: 'i' } },
        { 'address.state': { $regex: searchTerm, $options: 'i' } }
      ];
    }

    if (category && category !== 'all') {
      const trimmedCategory = category.trim();
      searchQuery.category = {
        $regex: new RegExp(`^${escapeRegExp(trimmedCategory)}$`, 'i')
      };
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

    // Fetch businesses
    let businesses = await Business.find(searchQuery)
      .select('-documents')
      .limit(parseInt(limit) || 50); // Default 50, or use limit param for autocomplete

    // Calculate distance if user location provided
    if (latitude && longitude) {
      const userLat = parseFloat(latitude);
      const userLon = parseFloat(longitude);

      // Add distance to each business
      businesses = businesses.map(business => {
        const businessLat = business.location.coordinates[1];
        const businessLon = business.location.coordinates[0];
        const distance = calculateDistance(userLat, userLon, businessLat, businessLon);

        return {
          ...business.toObject(),
          distance: distance / 1000 // Convert to kilometers
        };
      });

      // Sort by distance (nearest first)
      businesses.sort((a, b) => a.distance - b.distance);
    } else {
      // No location provided, sort by rating
      businesses.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0));
    }

    console.log(`✅ Found ${businesses.length} businesses`);

    res.status(200).json({
      success: true,
      count: businesses.length,
      businesses,
      filters: {
        search: searchTerm || null,
        ratingSource: ratingSource || null,
        minRating: minRating || null,
        category: category || null,
        hasLocation: !!(latitude && longitude)
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

    // Calculate if business is open NOW (backend handles all logic)
    const isOpenNow = checkIfBusinessIsOpen(business.openingHours);

    res.status(200).json({
      success: true,
      business: {
        ...business.toObject(),
        isOpenNow: isOpenNow.isOpen,
        openStatus: isOpenNow.status,
        nextStateChange: isOpenNow.nextChange
      }
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to check if business is open NOW (server-side logic)
function checkIfBusinessIsOpen(openingHours) {
  if (!openingHours) {
    return { isOpen: null, status: 'Hours not set', nextChange: null };
  }

  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = days[now.getDay()];
  const todayHours = openingHours[currentDay];

  if (!todayHours || todayHours.closed || todayHours.open === 'Closed') {
    return { isOpen: false, status: 'Closed today', nextChange: null };
  }

  // Parse time strings (e.g., "09:00 AM")
  const parseTime = (timeStr) => {
    if (!timeStr || timeStr === 'Closed') return null;
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes; // Return minutes since midnight
  };

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = parseTime(todayHours.open);
  const closeMinutes = parseTime(todayHours.close);

  if (openMinutes === null || closeMinutes === null) {
    return { isOpen: null, status: 'Hours not set', nextChange: null };
  }

  const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;

  let status, nextChange;
  if (isOpen) {
    status = `Open • Closes at ${todayHours.close}`;
    nextChange = todayHours.close;
  } else if (currentMinutes < openMinutes) {
    status = `Closed • Opens at ${todayHours.open}`;
    nextChange = todayHours.open;
  } else {
    status = 'Closed';
    // Find next opening day
    for (let i = 1; i <= 7; i++) {
      const nextDayIndex = (now.getDay() + i) % 7;
      const nextDay = days[nextDayIndex];
      const nextDayHours = openingHours[nextDay];

      if (nextDayHours && !nextDayHours.closed && nextDayHours.open !== 'Closed') {
        status = `Closed • Opens ${nextDay.charAt(0).toUpperCase() + nextDay.slice(1)} at ${nextDayHours.open}`;
        break;
      }
    }
  }

  return { isOpen, status, nextChange };
}

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

    console.log('📝 TripAdvisor update request:', { rating, reviewCount, profileUrl });

    // Validate rating if provided
    if (rating !== undefined && rating !== null && rating !== '') {
      const parsedRating = parseFloat(rating);
      if (isNaN(parsedRating) || parsedRating < 0 || parsedRating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be a valid number between 0 and 5'
        });
      }
    }

    // Validate review count if provided
    if (reviewCount !== undefined && reviewCount !== null && reviewCount !== '') {
      const parsedCount = parseInt(reviewCount);
      if (isNaN(parsedCount) || parsedCount < 0) {
        return res.status(400).json({
          success: false,
          message: 'Review count must be a valid positive number'
        });
      }
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

    // Initialize externalProfiles if needed
    if (!business.externalProfiles) {
      business.externalProfiles = {};
    }
    if (!business.externalProfiles.tripAdvisor) {
      business.externalProfiles.tripAdvisor = {};
    }

    // Track if any updates were made
    let updated = false;

    // Update TripAdvisor fields (only if valid values provided)
    if (rating !== undefined && rating !== null && rating !== '') {
      const parsedRating = parseFloat(rating);
      if (!isNaN(parsedRating)) {
        business.externalProfiles.tripAdvisor.rating = parsedRating;
        console.log('✅ Updated rating:', parsedRating);
        updated = true;
      }
    }

    if (reviewCount !== undefined && reviewCount !== null && reviewCount !== '') {
      const parsedCount = parseInt(reviewCount);
      if (!isNaN(parsedCount)) {
        business.externalProfiles.tripAdvisor.reviewCount = parsedCount;
        console.log('✅ Updated review count:', parsedCount);
        updated = true;
      }
    }

    if (profileUrl !== undefined && profileUrl !== null && profileUrl !== '') {
      business.externalProfiles.tripAdvisor.profileUrl = profileUrl.trim();
      console.log('✅ Updated profile URL:', profileUrl);
      updated = true;
    }

    // Only update lastSynced if something was actually updated
    if (updated) {
      business.externalProfiles.tripAdvisor.lastSynced = new Date();
      await business.save();
      console.log('✅ TripAdvisor data saved successfully');
    } else {
      return res.status(400).json({
        success: false,
        message: 'No valid data provided to update. Please provide rating, review count, or profile URL.'
      });
    }

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

