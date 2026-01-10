const cron = require('node-cron');
const Business = require('../models/Business.model');
const Coupon = require('../models/Coupon.model');
const { syncGoogleRatingsForBusiness } = require('../controllers/externalReviews.controller');
const logger = require('./logger');

/**
 * Automatic Google Ratings Sync Job
 * Runs daily at 2:00 AM to sync Google ratings for all businesses
 * Only syncs businesses that have a Google Business name configured
 */
const syncAllGoogleRatings = async () => {
  try {
    logger.info('🔄 Starting automatic Google ratings sync job...');
    
    // Find all businesses with Google Business name configured
    const businesses = await Business.find({
      'externalProfiles.googleBusiness.businessName': { $exists: true, $ne: '' },
      status: { $in: ['active', 'pending'] } // Only sync active or pending businesses
    }).select('_id name externalProfiles');

    if (!businesses || businesses.length === 0) {
      logger.info('ℹ️  No businesses found with Google Business name configured');
      return;
    }

    logger.info(`📊 Found ${businesses.length} businesses to sync`);

    let successCount = 0;
    let failCount = 0;

    // Sync ratings for each business (with delay to avoid rate limiting)
    for (let i = 0; i < businesses.length; i++) {
      const business = businesses[i];
      
      try {
        // Add delay between requests to avoid Google API rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }

        const result = await syncGoogleRatingsForBusiness(business._id.toString(), true);
        
        if (result.success) {
          successCount++;
          logger.info(`✅ Synced ratings for business: ${business.name} (${business._id})`);
        } else {
          failCount++;
          logger.warn(`⚠️  Failed to sync ratings for business: ${business.name} (${business._id}) - ${result.error}`);
        }
      } catch (error) {
        failCount++;
        logger.error(`❌ Error syncing ratings for business: ${business.name} (${business._id})`, error);
      }
    }

    logger.info(`✅ Google ratings sync job completed. Success: ${successCount}, Failed: ${failCount}`);
  } catch (error) {
    logger.error('❌ Error in automatic Google ratings sync job:', error);
  }
};

/**
 * Auto-expire coupons that have passed their 2-hour validity period
 * Runs every 5 minutes to check and expire coupons
 */
const expireCoupons = async () => {
  try {
    const now = new Date();
    
    // Find all active review_reward coupons that have expired
    const expiredCoupons = await Coupon.find({
      type: 'review_reward',
      status: 'active',
      validUntil: { $lt: now }
    });

    if (expiredCoupons.length === 0) {
      return;
    }

    logger.info(`🕐 Expiring ${expiredCoupons.length} coupon(s)...`);

    // Update all expired coupons
    const result = await Coupon.updateMany(
      {
        type: 'review_reward',
        status: 'active',
        validUntil: { $lt: now }
      },
      {
        $set: { status: 'expired' }
      }
    );

    logger.info(`✅ Expired ${result.modifiedCount} coupon(s)`);
  } catch (error) {
    logger.error('❌ Error in coupon expiration job:', error);
  }
};

/**
 * Initialize cron jobs
 */
const initializeSyncJobs = () => {
  // Schedule daily sync at 2:00 AM
  // Cron format: minute hour day month weekday
  // '0 2 * * *' = At 02:00 every day
  cron.schedule('0 2 * * *', syncAllGoogleRatings, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });

  logger.info('✅ Automatic Google ratings sync job scheduled (Daily at 2:00 AM)');

  // Schedule coupon expiration job every 5 minutes
  // Cron format: '*/5 * * * *' = Every 5 minutes
  cron.schedule('*/5 * * * *', expireCoupons, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  logger.info('✅ Automatic coupon expiration job scheduled (Every 5 minutes)');

  // Optional: Also run sync every 6 hours for more frequent updates
  // Uncomment the lines below if you want more frequent syncing:
  // cron.schedule('0 */6 * * *', syncAllGoogleRatings, {
  //   scheduled: true,
  //   timezone: "Asia/Kolkata"
  // });
  // logger.info('✅ Automatic Google ratings sync job scheduled (Every 6 hours)');
};

module.exports = {
  syncAllGoogleRatings,
  expireCoupons,
  initializeSyncJobs
};

