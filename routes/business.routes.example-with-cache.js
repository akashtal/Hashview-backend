// Example of using cache middleware in routes
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { cacheMiddleware } = require('../middleware/cache.middleware');
const {
  getNearbyBusinesses,
  getBusinessById,
  searchBusinesses
} = require('../controllers/business.controller');

// Public routes WITH caching
router.get('/nearby', cacheMiddleware(300), getNearbyBusinesses); // Cache for 5 minutes
router.get('/search', cacheMiddleware(300), searchBusinesses); // Cache for 5 minutes
router.get('/:id', cacheMiddleware(600), getBusinessById); // Cache for 10 minutes

// Protected routes WITHOUT caching (user-specific data)
router.get('/my/businesses', protect, authorize('business'), getMyBusinesses);

module.exports = router;

/* 
USAGE INSTRUCTIONS:
==================

1. Apply cacheMiddleware to any GET route:
   router.get('/endpoint', cacheMiddleware(expireSeconds), controller);

2. Cache expiration examples:
   - 60 seconds = 1 minute
   - 300 seconds = 5 minutes (default)
   - 600 seconds = 10 minutes
   - 1800 seconds = 30 minutes
   - 3600 seconds = 1 hour

3. Invalidate cache after updates:
   const { invalidateCache } = require('../middleware/cache.middleware');
   
   // In controller after update/delete:
   await invalidateCache('/api/business'); // Invalidates all business caches
   await invalidateCache('/api/business/nearby'); // Specific pattern

4. Best practices:
   - Cache public, frequently accessed data
   - Don't cache user-specific data
   - Don't cache real-time data
   - Set appropriate expiration times
   - Invalidate cache on updates
*/

