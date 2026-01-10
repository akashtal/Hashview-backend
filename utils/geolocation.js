// Calculate distance between two coordinates using Haversine formula
exports.calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in meters
  return distance;
};

// Check if user is within geofence
exports.isWithinGeofence = (userLat, userLon, businessLat, businessLon, radius) => {
  const distance = exports.calculateDistance(userLat, userLon, businessLat, businessLon);
  console.log(`   🔍 Distance calculation: ${distance.toFixed(2)}m vs ${radius}m radius`);
  const isWithin = distance <= radius;
  console.log(`   📍 Result: ${isWithin ? '✅ Within radius' : '❌ Outside radius'}`);
  return isWithin;
};

// Get nearby locations using MongoDB geospatial query
exports.getNearbyQuery = (longitude, latitude, maxDistance = 50) => {
  return {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance // in meters
      }
    }
  };
};

