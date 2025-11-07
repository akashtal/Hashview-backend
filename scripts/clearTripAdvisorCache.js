/**
 * Clear TripAdvisor Cache for a Business
 * Forces fresh data fetch on next sync
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function clearCache() {
  try {
    const businessId = process.argv[2];

    if (!businessId) {
      console.error('\n❌ Error: Business ID is required\n');
      console.log('Usage: node scripts/clearTripAdvisorCache.js <businessId>\n');
      console.log('Example:');
      console.log('  node scripts/clearTripAdvisorCache.js 690bc2d62f1631b654eddefc\n');
      process.exit(1);
    }

    console.log('\n🔧 Clearing TripAdvisor Cache...\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // Clear the lastSynced timestamp to force fresh fetch
    const result = await db.collection('businesses').updateOne(
      { _id: new mongoose.Types.ObjectId(businessId) },
      { 
        $unset: { 
          'externalProfiles.tripAdvisor.lastSynced': ''
        } 
      }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Cache cleared! Next sync will fetch fresh data.\n');
    } else {
      console.log('ℹ️  Business not found or no cache to clear.\n');
    }

    console.log('🎉 Done! Try syncing again in the app.\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

clearCache();

