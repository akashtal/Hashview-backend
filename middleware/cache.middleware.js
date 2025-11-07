const { getCache, setCache, isCacheAvailable } = require('../config/redis');

/**
 * Cache middleware for GET requests
 * @param {number} expireSeconds - Cache expiration time in seconds (default: 300 = 5 minutes)
 * @returns {Function} Express middleware
 */
const cacheMiddleware = (expireSeconds = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if cache not available
    if (!isCacheAvailable()) {
      return next();
    }

    try {
      // Generate cache key from request URL and query params
      const cacheKey = `cache:${req.originalUrl || req.url}`;

      // Try to get from cache
      const cachedData = await getCache(cacheKey);

      if (cachedData) {
        console.log(`✅ Cache HIT: ${cacheKey}`);
        return res.status(200).json(cachedData);
      }

      console.log(`❌ Cache MISS: ${cacheKey}`);

      // Store original res.json
      const originalJson = res.json.bind(res);

      // Override res.json to cache response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200) {
          setCache(cacheKey, data, expireSeconds);
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

/**
 * Invalidate cache for specific patterns
 * Usage: await invalidateCache('business:*') after business update
 */
const invalidateCache = async (pattern) => {
  const { deleteCachePattern } = require('../config/redis');
  await deleteCachePattern(`cache:*${pattern}*`);
};

module.exports = {
  cacheMiddleware,
  invalidateCache
};

