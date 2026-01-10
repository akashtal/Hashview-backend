const { calculateDistance, isWithinGeofence } = require('../../../utils/geolocation');

describe('Geolocation Utils', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points correctly', () => {
      // New York to Los Angeles (approx 3936 km)
      const lat1 = 40.7128; // New York
      const lon1 = -74.0060;
      const lat2 = 34.0522; // Los Angeles
      const lon2 = -118.2437;
      
      const distance = calculateDistance(lat1, lon1, lat2, lon2);
      
      // Distance should be approximately 3,936,000 meters (3,936 km)
      expect(distance).toBeGreaterThan(3900000);
      expect(distance).toBeLessThan(4000000);
    });

    it('should return 0 for same coordinates', () => {
      const lat = 40.7128;
      const lon = -74.0060;
      
      const distance = calculateDistance(lat, lon, lat, lon);
      
      expect(distance).toBe(0);
    });

    it('should calculate small distances accurately', () => {
      // Two points 100 meters apart (approximately)
      const lat1 = 40.7128;
      const lon1 = -74.0060;
      const lat2 = 40.7138; // ~111 meters north
      const lon2 = -74.0060;
      
      const distance = calculateDistance(lat1, lon1, lat2, lon2);
      
      // Should be approximately 111 meters
      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(120);
    });
  });

  describe('isWithinGeofence', () => {
    it('should return true when within radius', () => {
      const userLat = 40.7128;
      const userLon = -74.0060;
      const businessLat = 40.7130; // ~22 meters away
      const businessLon = -74.0060;
      const radius = 50; // 50 meters
      
      const result = isWithinGeofence(userLat, userLon, businessLat, businessLon, radius);
      
      expect(result).toBe(true);
    });

    it('should return false when outside radius', () => {
      const userLat = 40.7128;
      const userLon = -74.0060;
      const businessLat = 40.7150; // ~244 meters away
      const businessLon = -74.0060;
      const radius = 50; // 50 meters
      
      const result = isWithinGeofence(userLat, userLon, businessLat, businessLon, radius);
      
      expect(result).toBe(false);
    });

    it('should return true when exactly at radius boundary', () => {
      const userLat = 40.7128;
      const userLon = -74.0060;
      const businessLat = 40.7128;
      const businessLon = -74.0064; // ~50 meters away
      const radius = 50; // 50 meters
      
      const result = isWithinGeofence(userLat, userLon, businessLat, businessLon, radius);
      
      expect(result).toBe(true);
    });

    it('should handle large radius values', () => {
      const userLat = 40.7128;
      const userLon = -74.0060;
      const businessLat = 40.7200; // ~800 meters away
      const businessLon = -74.0060;
      const radius = 1000; // 1 km
      
      const result = isWithinGeofence(userLat, userLon, businessLat, businessLon, radius);
      
      expect(result).toBe(true);
    });
  });
});

