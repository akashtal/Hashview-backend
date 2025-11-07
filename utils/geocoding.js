const axios = require('axios');

/**
 * Geocode an address using Google Maps Geocoding API
 * @param {string} address - Full address to geocode
 * @param {string} businessName - Business name for better accuracy
 * @returns {Promise<{latitude: number, longitude: number, formattedAddress: string}>}
 */
exports.geocodeAddress = async (address, businessName = '') => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️  GOOGLE_MAPS_API_KEY not found in environment variables');
      throw new Error('Google Maps API key not configured');
    }

    // Combine business name with address for better accuracy
    const searchQuery = businessName 
      ? `${businessName}, ${address}` 
      : address;

    console.log(`\n🌍 Geocoding address: "${searchQuery}"`);

    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: searchQuery,
        key: apiKey
      }
    });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];
      const location = result.geometry.location;
      
      console.log(`✅ Geocoding successful:`);
      console.log(`   Coordinates: [${location.lng}, ${location.lat}]`);
      console.log(`   Formatted Address: ${result.formatted_address}`);

      return {
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: result.formatted_address
      };
    } else {
      console.error(`❌ Geocoding failed: ${response.data.status}`);
      throw new Error(`Geocoding failed: ${response.data.status}`);
    }
  } catch (error) {
    console.error('❌ Geocoding error:', error.message);
    throw error;
  }
};

/**
 * Validate if coordinates are reasonable (not [0, 0] or null)
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {boolean}
 */
exports.validateCoordinates = (latitude, longitude) => {
  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    return false;
  }
  
  // Check if coordinates are [0, 0] (invalid)
  if (latitude === 0 && longitude === 0) {
    return false;
  }
  
  // Check if coordinates are within valid ranges
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false;
  }
  
  return true;
};

/**
 * Fallback: Use OpenStreetMap Nominatim if Google Maps fails
 * @param {string} address 
 * @param {string} businessName 
 * @returns {Promise<{latitude: number, longitude: number, formattedAddress: string}>}
 */
exports.geocodeWithNominatim = async (address, businessName = '') => {
  try {
    const searchQuery = businessName 
      ? `${businessName}, ${address}` 
      : address;

    console.log(`\n🌍 Trying Nominatim geocoding: "${searchQuery}"`);

    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: searchQuery,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'HashView-App/1.0'
      }
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      
      console.log(`✅ Nominatim geocoding successful:`);
      console.log(`   Coordinates: [${result.lon}, ${result.lat}]`);
      console.log(`   Display Name: ${result.display_name}`);

      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        formattedAddress: result.display_name
      };
    } else {
      throw new Error('No results from Nominatim');
    }
  } catch (error) {
    console.error('❌ Nominatim geocoding error:', error.message);
    throw error;
  }
};
