const Business = require('../models/Business.model');
const axios = require('axios');

// Helper function to sync Google ratings (can be called from anywhere)
const syncGoogleRatingsForBusiness = async (businessId, ratingsOnly = true) => {
  try {
    // Check if Google Places API key is configured
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      console.error('❌ GOOGLE_PLACES_API_KEY is not configured in environment variables');
      return { success: false, error: 'Google Places API key is not configured' };
    }

    const business = await Business.findById(businessId);
    if (!business) {
      console.error(`❌ Business not found: ${businessId}`);
      return { success: false, error: 'Business not found' };
    }

    const googleBusinessName = business.externalProfiles?.googleBusiness?.businessName;
    let googlePlaceId = business.externalProfiles?.googleBusiness?.placeId;

    if (!googleBusinessName && !googlePlaceId) {
      console.log(`⚠️  No Google Business name for business: ${businessId}`);
      return { success: false, error: 'Google Business name not configured' };
    }

    let placeId = googlePlaceId;

    // If no Place ID, search using business name
    if (!placeId) {
      const searchQuery = `${googleBusinessName} ${business.address?.fullAddress || ''}`;
      console.log('🔍 Searching for business on Google:', searchQuery);
      
      try {
        const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json`;
        const findPlaceResponse = await axios.get(findPlaceUrl, {
          params: {
            input: searchQuery.trim(),
            inputtype: 'textquery',
            fields: 'place_id,name,formatted_address',
            key: process.env.GOOGLE_PLACES_API_KEY
          }
        });

        console.log('🔍 Google Places API Find Place response status:', findPlaceResponse.status);
        
        // Check for API errors
        if (findPlaceResponse.data.status && findPlaceResponse.data.status !== 'OK' && findPlaceResponse.data.status !== 'ZERO_RESULTS') {
          console.error('❌ Google Places API error:', findPlaceResponse.data.status, findPlaceResponse.data.error_message);
          return { 
            success: false, 
            error: `Google Places API error: ${findPlaceResponse.data.error_message || findPlaceResponse.data.status}` 
          };
        }

        if (!findPlaceResponse.data.candidates || findPlaceResponse.data.candidates.length === 0) {
          console.error(`❌ Business not found on Google: "${googleBusinessName}"`);
          return { success: false, error: `Business not found on Google: "${googleBusinessName}". Please verify the business name matches your Google Business listing exactly.` };
        }

        placeId = findPlaceResponse.data.candidates[0].place_id;
        console.log('✅ Found Place ID:', placeId);
      } catch (apiError) {
        console.error('❌ Google Places API request failed:', apiError.response?.data || apiError.message);
        return { 
          success: false, 
          error: `Google Places API request failed: ${apiError.response?.data?.error_message || apiError.message}` 
        };
      }
    }

    // Google Places API - Get Place Details (including reviews)
    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json`;
      const detailsResponse = await axios.get(detailsUrl, {
        params: {
          place_id: placeId,
          fields: 'name,rating,user_ratings_total,reviews',
          key: process.env.GOOGLE_PLACES_API_KEY
        }
      });

      console.log('🔍 Google Places API Details response status:', detailsResponse.status);

      // Check for API errors
      if (detailsResponse.data.status && detailsResponse.data.status !== 'OK') {
        console.error('❌ Google Places API Details error:', detailsResponse.data.status, detailsResponse.data.error_message);
        return { 
          success: false, 
          error: `Google Places API error: ${detailsResponse.data.error_message || detailsResponse.data.status}` 
        };
      }

      const placeDetails = detailsResponse.data.result;

      if (!placeDetails) {
        console.error('❌ No place details returned from Google Places API');
        return { success: false, error: 'No place details returned from Google Places API' };
      }

      // Format Google reviews (only if not ratings-only)
      const googleReviews = ratingsOnly ? [] : (placeDetails.reviews || []).map(review => ({
        reviewId: review.time?.toString?.() || String(review.time || Date.now()),
        author: review.author_name,
        authorPhoto: review.profile_photo_url,
        rating: review.rating,
        text: review.text,
        date: new Date((review.time || Math.floor(Date.now()/1000)) * 1000),
        relativeTime: review.relative_time_description
      }));

      // Update business with Google data
      business.externalProfiles.googleBusiness = {
        businessName: googleBusinessName,
        placeId: placeId,
        rating: placeDetails.rating,
        reviewCount: placeDetails.user_ratings_total,
        lastSynced: new Date()
      };

      if (!ratingsOnly) {
        business.externalReviews.google = googleReviews;
      }

      await business.save();

      console.log(`✅ Google ratings synced for business: ${businessId} - Rating: ${placeDetails.rating}, Count: ${placeDetails.user_ratings_total}`);
      
      return {
        success: true,
        data: {
          rating: placeDetails.rating,
          reviewCount: placeDetails.user_ratings_total,
          reviews: ratingsOnly ? undefined : googleReviews
        }
      };
    } catch (apiError) {
      console.error('❌ Google Places API Details request failed:', apiError.response?.data || apiError.message);
      return { 
        success: false, 
        error: `Google Places API Details request failed: ${apiError.response?.data?.error_message || apiError.message}` 
      };
    }
  } catch (error) {
    console.error(`❌ Google Ratings sync error for business ${businessId}:`, error);
    console.error('Error stack:', error.stack);
    return { 
      success: false, 
      error: error.message || 'Unknown error occurred while syncing Google ratings' 
    };
  }
};

// Export helper function for use in other controllers
exports.syncGoogleRatingsForBusiness = syncGoogleRatingsForBusiness;

// @desc    Sync Google Reviews
// @route   POST /api/business/:id/sync-google-reviews
// @access  Private (Business Owner or Admin)
exports.syncGoogleReviews = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Verify ownership
    if (req.user.role !== 'admin' && business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to sync reviews for this business'
      });
    }

    const ratingsOnly = (process.env.EXTERNAL_RATINGS_ONLY === 'true') || (req.query.ratingsOnly === 'true');
    const result = await syncGoogleRatingsForBusiness(req.params.id, ratingsOnly);

    if (!result.success) {
      if (result.error === 'Business not found') {
        return res.status(404).json({
          success: false,
          message: 'Business not found'
        });
      }
      if (result.error === 'Google Business name not configured') {
        return res.status(400).json({
          success: false,
          message: 'Google Business name or Place ID not configured. Please provide your Google Business name (e.g., "Your Business Name, City") in business registration.'
        });
      }
      if (result.error.includes('Business not found on Google')) {
        return res.status(404).json({
          success: false,
          message: result.error,
          suggestion: 'Try entering just your business name without address (e.g., "THAITASTIC" instead of full URL)'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to sync Google reviews',
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: ratingsOnly ? 'Google rating synced successfully' : 'Google reviews synced successfully',
      data: result.data
    });

  } catch (error) {
    console.error('Google Reviews sync error:', error);
    
    if (error.response?.data?.error_message) {
      return res.status(400).json({
        success: false,
        message: error.response.data.error_message
      });
    }

    next(error);
  }
};

// @desc    Sync TripAdvisor Reviews using Common Ninja (with 6-12 hour caching)
// @route   POST /api/external-reviews/:id/sync-tripadvisor-reviews
// @access  Private (Business Owner or Admin)
exports.syncTripAdvisorReviews = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Verify ownership
    if (req.user.role !== 'admin' && business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to sync reviews for this business'
      });
    }

    const tripAdvisorUrl = business.externalProfiles?.tripAdvisor?.profileUrl;

    if (!tripAdvisorUrl) {
      return res.status(400).json({
        success: false,
        message: 'TripAdvisor profile URL not configured for this business'
      });
    }

    // Check if widget ID is configured
    const widgetId = business.externalProfiles?.tripAdvisor?.commonNinjaWidgetId;
    
    if (!widgetId) {
      return res.status(400).json({
        success: false,
        message: 'Common Ninja widget ID not configured. Please create a TripAdvisor widget in Common Ninja dashboard and add the widget ID to business settings.',
        instructions: {
          step1: 'Go to https://www.commoninja.com/dashboard',
          step2: 'Create a new TripAdvisor Reviews widget',
          step3: 'Get the widget ID from the widget settings',
          step4: 'Add widget ID to business externalProfiles.tripAdvisor.commonNinjaWidgetId'
        }
      });
    }

    // ============================================
    // CACHING LOGIC (6-12 hours as per user requirement)
    // ============================================
    const CACHE_HOURS = parseInt(process.env.TRIPADVISOR_CACHE_HOURS || '6'); // Default: 6 hours
    const forceRefresh = req.query.force === 'true'; // Allow manual force refresh
    const lastSynced = business.externalProfiles?.tripAdvisor?.lastSynced;

    if (!forceRefresh && lastSynced) {
      const hoursSinceSync = (Date.now() - new Date(lastSynced).getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceSync < CACHE_HOURS) {
        console.log(`✅ Using cached TripAdvisor data for: ${business.name}`);
        console.log(`   Last synced: ${hoursSinceSync.toFixed(1)} hours ago`);
        console.log(`   Cache valid for: ${CACHE_HOURS} hours`);
        
        return res.status(200).json({
          success: true,
          message: 'Using cached TripAdvisor data',
          cached: true,
          data: {
            rating: business.externalProfiles.tripAdvisor.rating,
            reviewCount: business.externalProfiles.tripAdvisor.reviewCount,
            lastSynced: business.externalProfiles.tripAdvisor.lastSynced,
            widgetId: business.externalProfiles.tripAdvisor.commonNinjaWidgetId,
            widgetUrl: business.externalProfiles.tripAdvisor.commonNinjaWidgetUrl,
            cacheExpiresIn: `${(CACHE_HOURS - hoursSinceSync).toFixed(1)} hours`
          }
        });
      }
    }

    // ============================================
    // FETCH FRESH DATA FROM COMMON NINJA API
    // ============================================
    console.log(`🔄 Fetching fresh data from Common Ninja for: ${business.name}`);
    if (forceRefresh) console.log('   (Force refresh requested)');
    
    const { fetchTripAdvisorReviews, getWidgetUrl } = require('../utils/commonNinja');
    
    const result = await fetchTripAdvisorReviews(widgetId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to fetch TripAdvisor reviews',
        details: result.details
      });
    }

    // Update business with rating and count (NO review text as per user requirement)
    business.externalProfiles.tripAdvisor.rating = result.rating;
    business.externalProfiles.tripAdvisor.reviewCount = result.reviewCount;
    business.externalProfiles.tripAdvisor.lastSynced = result.lastSynced;
    business.externalProfiles.tripAdvisor.commonNinjaWidgetId = result.widgetId;
    business.externalProfiles.tripAdvisor.commonNinjaWidgetUrl = getWidgetUrl(result.widgetId);

    // DO NOT store review text (user only wants rating + count)
    // business.externalReviews.tripAdvisor = []; // Cleared

    await business.save();

    console.log(`✅ TripAdvisor rating synced for business: ${business.name}`);
    console.log(`   Rating: ${result.rating}/5`);
    console.log(`   Review Count: ${result.reviewCount}`);
    console.log(`   Widget ID: ${result.widgetId}`);
    console.log(`   Cached for: ${CACHE_HOURS} hours`);

    return res.status(200).json({
      success: true,
      message: `Successfully synced TripAdvisor rating`,
      cached: false,
      data: {
        rating: result.rating,
        reviewCount: result.reviewCount,
        widgetId: result.widgetId,
        widgetUrl: business.externalProfiles.tripAdvisor.commonNinjaWidgetUrl,
        lastSynced: result.lastSynced,
        cacheExpiresIn: `${CACHE_HOURS} hours`
      }
    });

  } catch (error) {
    console.error('TripAdvisor sync error:', error);
    next(error);
  }
};

// @desc    Get all reviews (internal + external)
// @route   GET /api/business/:id/all-reviews
// @access  Public
exports.getAllReviews = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Get internal HashView reviews
    const Review = require('../models/Review.model');
    const internalReviews = await Review.find({ business: req.params.id })
      .populate('user', 'name profileImage')
      .sort({ createdAt: -1 });

    // Format all reviews into a unified structure
    const allReviews = {
      internal: {
        source: 'HashView',
        count: internalReviews.length,
        averageRating: business.rating.average,
        reviews: internalReviews.map(review => ({
          id: review._id,
          source: 'hashview',
          author: review.user?.name || 'Anonymous',
          authorPhoto: review.user?.profileImage,
          rating: review.rating,
          text: review.comment,
          date: review.createdAt,
          verified: review.verified
        }))
      },
      google: {
        source: 'Google',
        count: business.externalProfiles?.googleBusiness?.reviewCount || 0,
        averageRating: business.externalProfiles?.googleBusiness?.rating || 0,
        lastSynced: business.externalProfiles?.googleBusiness?.lastSynced,
        reviews: (business.externalReviews?.google || []).map(review => ({
          id: review.reviewId,
          source: 'google',
          author: review.author,
          authorPhoto: review.authorPhoto,
          rating: review.rating,
          text: review.text,
          date: review.date,
          relativeTime: review.relativeTime
        }))
      },
      tripAdvisor: {
        source: 'TripAdvisor',
        count: business.externalProfiles?.tripAdvisor?.reviewCount || 0,
        averageRating: business.externalProfiles?.tripAdvisor?.rating || 0,
        lastSynced: business.externalProfiles?.tripAdvisor?.lastSynced,
        reviews: (business.externalReviews?.tripAdvisor || []).map(review => ({
          id: review.reviewId,
          source: 'tripadvisor',
          author: review.author,
          rating: review.rating,
          text: review.text,
          date: review.date,
          url: review.url
        }))
      },
      summary: {
        totalReviews: internalReviews.length + 
          (business.externalReviews?.google?.length || 0) + 
          (business.externalReviews?.tripAdvisor?.length || 0),
        averageRating: calculateOverallRating(business, internalReviews)
      }
    };

    res.status(200).json({
      success: true,
      data: allReviews
    });

  } catch (error) {
    console.error('Get all reviews error:', error);
    next(error);
  }
};

// Helper function to calculate overall rating
function calculateOverallRating(business, internalReviews) {
  let totalRating = 0;
  let totalCount = 0;

  // Internal reviews
  if (internalReviews.length > 0) {
    totalRating += business.rating.average * internalReviews.length;
    totalCount += internalReviews.length;
  }

  // Google reviews
  const googleCount = business.externalProfiles?.googleBusiness?.reviewCount || 0;
  const googleRating = business.externalProfiles?.googleBusiness?.rating || 0;
  if (googleCount > 0) {
    totalRating += googleRating * googleCount;
    totalCount += googleCount;
  }

  // TripAdvisor reviews
  const tripAdvisorCount = business.externalProfiles?.tripAdvisor?.reviewCount || 0;
  const tripAdvisorRating = business.externalProfiles?.tripAdvisor?.rating || 0;
  if (tripAdvisorCount > 0) {
    totalRating += tripAdvisorRating * tripAdvisorCount;
    totalCount += tripAdvisorCount;
  }

  return totalCount > 0 ? (totalRating / totalCount).toFixed(1) : 0;
}

