const axios = require('axios');

/**
 * Common Ninja API Integration for TripAdvisor Reviews
 * Docs: https://www.commoninja.com/api-docs
 */

const COMMON_NINJA_CONFIG = {
  apiKey: process.env.COMMON_NINJA_API_KEY,
  apiUrl: 'https://api.commoninja.com/platform/api/v1',
  widgetType: 'tripadvisor-reviews'
};

/**
 * Fetch TripAdvisor rating from Common Ninja Widget (rating + count only, no review text)
 * Uses ChatGPT's recommended approach: GET /widgets/{widgetId}/data
 * @param {string} widgetId - Common Ninja widget ID (created manually in dashboard)
 * @returns {Promise<Object>} Rating data only
 */
exports.fetchTripAdvisorReviews = async (widgetId) => {
  try {
    if (!COMMON_NINJA_CONFIG.apiKey) {
      throw new Error('Common Ninja API key not configured. Add COMMON_NINJA_API_KEY to .env file');
    }

    if (!widgetId) {
      throw new Error('Widget ID is required. Please create a TripAdvisor widget in Common Ninja dashboard first');
    }

    console.log('\n🌐 Common Ninja: Fetching TripAdvisor rating (rating + count only)');
    console.log('   Widget ID:', widgetId);

    // Use CN-API-Token header (Bearer token doesn't work)
    const headers = {
      'CN-API-Token': COMMON_NINJA_CONFIG.apiKey,
      'Content-Type': 'application/json'
    };

    // Fetch widget data using Common Ninja API endpoint (ChatGPT's recommended endpoint)
    console.log('   Calling API: GET /platform/api/v1/widgets/{widgetId}');
    const response = await axios.get(
      `${COMMON_NINJA_CONFIG.apiUrl}/widgets/${widgetId}`,
      { 
        headers,
        timeout: 15000 
      }
    );

    const widgetData = response.data;
    console.log('   Widget Data Structure:', {
      hasData: !!widgetData.data,
      hasContent: !!widgetData.data?.content,
      hasRating: !!widgetData.data?.content?.rating,
      hasReviewCount: !!widgetData.data?.content?.reviewCount,
      itemsCount: widgetData.data?.content?.items?.length || 0
    });

    // Extract rating and count (try multiple approaches)
    let rating = 0;
    let reviewCount = 0;

    // Approach 1: Direct rating/reviewCount (ChatGPT's suggestion)
    if (widgetData.data?.content?.rating !== undefined) {
      rating = parseFloat(widgetData.data.content.rating);
      reviewCount = parseInt(widgetData.data.content.reviewCount || 0);
      console.log('   ✅ Using direct rating/reviewCount fields');
    }
    // Approach 2: Calculate from reviews array
    else {
      const reviews = widgetData.data?.content?.items || [];
      reviewCount = reviews.length;
      
      if (reviewCount > 0) {
        const totalRating = reviews.reduce((sum, review) => {
          return sum + (parseFloat(review.rating || review.stars || review.score || 0));
        }, 0);
        rating = totalRating / reviewCount;
        console.log('   ✅ Calculated rating from reviews array');
      } else {
        console.log('   ⚠️  No reviews found in widget yet');
      }
    }

    console.log(`   ✅ Rating fetched successfully`);
    console.log(`   Average Rating: ${rating}/5`);
    console.log(`   Total Reviews: ${reviewCount}`);

    // Return ONLY rating and count (no review text as per user requirement)
    return {
      success: true,
      widgetId: widgetId,
      rating: rating,
      reviewCount: reviewCount,
      lastSynced: new Date()
    };

  } catch (error) {
    console.error('❌ Common Ninja API Error:', error.response?.data || error.message);
    
    // Provide helpful error messages
    let errorMessage = error.message;
    if (error.response?.status === 401) {
      errorMessage = 'Invalid Common Ninja API key. Please check COMMON_NINJA_API_KEY in .env';
    } else if (error.response?.status === 404) {
      errorMessage = 'Widget not found. Please verify the widget ID is correct';
    } else if (error.response?.status === 403) {
      errorMessage = 'Access forbidden. Please check your Common Ninja API permissions';
    }
    
    return {
      success: false,
      error: errorMessage,
      details: error.response?.data
    };
  }
};

/**
 * Get widget embed code for frontend display
 * @param {string} widgetId - Common Ninja widget ID
 * @returns {string} Widget embed code
 */
exports.getWidgetEmbedCode = (widgetId) => {
  if (!widgetId) {
    throw new Error('Widget ID is required');
  }

  return `<div class="commoninja-widget" data-widget-id="${widgetId}"></div>
<script src="https://cdn.commoninja.com/sdk/v1/commonninja.js" defer></script>`;
};

/**
 * Get widget URL for React Native WebView
 * @param {string} widgetId - Common Ninja widget ID
 * @returns {string} Widget URL
 */
exports.getWidgetUrl = (widgetId) => {
  if (!widgetId) {
    throw new Error('Widget ID is required');
  }

  return `https://widgets.commoninja.com/${widgetId}`;
};

/**
 * Get all widgets
 * @returns {Promise<Array>} List of widgets
 */
exports.getAllWidgets = async () => {
  try {
    if (!COMMON_NINJA_CONFIG.apiKey) {
      throw new Error('Common Ninja API key not configured');
    }

    const response = await axios.get(
      `${COMMON_NINJA_CONFIG.apiUrl}/widgets`,
      {
        headers: {
          'CN-API-Token': COMMON_NINJA_CONFIG.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      widgets: response.data
    };
  } catch (error) {
    console.error('Common Ninja get widgets error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update widget configuration
 * @param {string} widgetId - Common Ninja widget ID
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Updated widget data
 */
exports.updateWidget = async (widgetId, config) => {
  try {
    if (!COMMON_NINJA_CONFIG.apiKey) {
      throw new Error('Common Ninja API key not configured');
    }

    const response = await axios.put(
      `${COMMON_NINJA_CONFIG.apiUrl}/widgets/${widgetId}`,
      { config },
      {
        headers: {
          'CN-API-Token': COMMON_NINJA_CONFIG.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Common Ninja update error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete a widget
 * @param {string} widgetId - Common Ninja widget ID
 * @returns {Promise<boolean>} Success status
 */
exports.deleteWidget = async (widgetId) => {
  try {
    if (!COMMON_NINJA_CONFIG.apiKey) {
      throw new Error('Common Ninja API key not configured');
    }

    await axios.delete(
      `${COMMON_NINJA_CONFIG.apiUrl}/widgets/${widgetId}`,
      {
        headers: {
          'CN-API-Token': COMMON_NINJA_CONFIG.apiKey
        }
      }
    );

    return true;
  } catch (error) {
    console.error('Common Ninja delete error:', error.response?.data || error.message);
    return false;
  }
};

module.exports = exports;

