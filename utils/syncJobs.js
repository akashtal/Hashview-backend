const cron = require('node-cron');
const Business = require('../models/Business.model');
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
  initializeSyncJobs
};

