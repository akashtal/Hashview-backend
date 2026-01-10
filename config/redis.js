const redis = require('redis');
const logger = require('../utils/logger');

let redisClient = null;

// Initialize Redis client
const initializeRedis = async () => {
  try {
    if (!process.env.REDIS_URL) {
      logger.info('ℹ️  Redis not configured (set REDIS_URL environment variable)');
      return null;
    }

    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: Too many retries, stopping');
            return new Error('Too many retries');
          }
          // Reconnect after 1 second
          return 1000;
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    redisClient.on('reconnecting', () => {
      logger.info('⏳ Redis reconnecting...');
    });

    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    logger.error('Redis initialization error:', error);
    return null;
  }
};

// Get value from cache
const getCache = async (key) => {
  if (!redisClient || !redisClient.isOpen) {
    return null;
  }

  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Redis GET error for key ${key}:`, error);
    return null;
  }
};

// Set value in cache
const setCache = async (key, value, expireSeconds = 300) => {
  if (!redisClient || !redisClient.isOpen) {
    return false;
  }

  try {
    await redisClient.setEx(key, expireSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error(`Redis SET error for key ${key}:`, error);
    return false;
  }
};

// Delete value from cache
const deleteCache = async (key) => {
  if (!redisClient || !redisClient.isOpen) {
    return false;
  }

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.error(`Redis DELETE error for key ${key}:`, error);
    return false;
  }
};

// Delete multiple keys by pattern
const deleteCachePattern = async (pattern) => {
  if (!redisClient || !redisClient.isOpen) {
    return false;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    return true;
  } catch (error) {
    logger.error(`Redis DELETE PATTERN error for pattern ${pattern}:`, error);
    return false;
  }
};

// Check if cache is available
const isCacheAvailable = () => {
  return redisClient && redisClient.isOpen;
};

// Close Redis connection
const closeRedis = async () => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
};

module.exports = {
  initializeRedis,
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  isCacheAvailable,
  closeRedis,
  redisClient
};

