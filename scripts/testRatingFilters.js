/**
 * Test Rating Filters to Verify They Work Correctly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../models/Business.model');

async function testRatingFilters() {
  try {
    console.log('\n🧪 Testing Star-Based Rating Filters\n');
    console.log('═══════════════════════════════════════════════════\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get total businesses
    const total = await Business.countDocuments({ status: 'active' });
    console.log(`📊 Total active businesses: ${total}\n`);

    // Test 1: HashView 5-star filter
    console.log('Test 1: HashView 5-Star Filter');
    const hashview5Star = await Business.find({
      status: 'active',
      'rating.average': { $gte: 5.0 }
    });
    console.log(`   Found: ${hashview5Star.length} businesses`);
    if (hashview5Star.length > 0) {
      console.log(`   Example: "${hashview5Star[0].name}" (${hashview5Star[0].rating?.average || 0} stars)`);
    }
    console.log('');

    // Test 2: Google 4-star filter
    console.log('Test 2: Google 4-Star Filter');
    const google4Star = await Business.find({
      status: 'active',
      'externalProfiles.googleBusiness.rating': { $gte: 4.0 }
    });
    console.log(`   Found: ${google4Star.length} businesses`);
    if (google4Star.length > 0) {
      console.log(`   Example: "${google4Star[0].name}" (Google: ${google4Star[0].externalProfiles?.googleBusiness?.rating || 0})`);
    }
    console.log('');

    // Test 3: TripAdvisor 3-star filter
    console.log('Test 3: TripAdvisor 3-Star Filter');
    const tripadvisor3Star = await Business.find({
      status: 'active',
      'externalProfiles.tripAdvisor.rating': { $gte: 3.0 }
    });
    console.log(`   Found: ${tripadvisor3Star.length} businesses`);
    if (tripadvisor3Star.length > 0) {
      console.log(`   Example: "${tripadvisor3Star[0].name}" (TripAdvisor: ${tripadvisor3Star[0].externalProfiles?.tripAdvisor?.rating || 0})`);
    }
    console.log('');

    // Test 4: No filter (should return all)
    console.log('Test 4: No Filter (All Businesses)');
    const noFilter = await Business.find({
      status: 'active'
    }).limit(50);
    console.log(`   Found: ${noFilter.length} businesses (limited to 50)`);
    console.log('');

    // Show rating distribution
    console.log('📊 Rating Distribution:');
    const allBusinesses = await Business.find({ status: 'active' });
    
    let hashview5Plus = 0, hashview4Plus = 0, hashview3Plus = 0;
    let google5Plus = 0, google4Plus = 0, google3Plus = 0;
    let tripadvisor5Plus = 0, tripadvisor4Plus = 0, tripadvisor3Plus = 0;

    allBusinesses.forEach(b => {
      const hRating = b.rating?.average || 0;
      const gRating = b.externalProfiles?.googleBusiness?.rating || 0;
      const tRating = b.externalProfiles?.tripAdvisor?.rating || 0;

      if (hRating >= 5) hashview5Plus++;
      if (hRating >= 4) hashview4Plus++;
      if (hRating >= 3) hashview3Plus++;

      if (gRating >= 5) google5Plus++;
      if (gRating >= 4) google4Plus++;
      if (gRating >= 3) google3Plus++;

      if (tRating >= 5) tripadvisor5Plus++;
      if (tRating >= 4) tripadvisor4Plus++;
      if (tRating >= 3) tripadvisor3Plus++;
    });

    console.log(`\n   HashView:`);
    console.log(`      5+ stars: ${hashview5Plus}`);
    console.log(`      4+ stars: ${hashview4Plus}`);
    console.log(`      3+ stars: ${hashview3Plus}`);

    console.log(`\n   Google:`);
    console.log(`      5+ stars: ${google5Plus}`);
    console.log(`      4+ stars: ${google4Plus}`);
    console.log(`      3+ stars: ${google3Plus}`);

    console.log(`\n   TripAdvisor:`);
    console.log(`      5+ stars: ${tripadvisor5Plus}`);
    console.log(`      4+ stars: ${tripadvisor4Plus}`);
    console.log(`      3+ stars: ${tripadvisor3Plus}`);

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ All Tests Complete!');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('💡 Test in Mobile App:');
    console.log('   1. Tap "Google" filter');
    console.log('   2. Tap "4+" stars');
    console.log(`   3. Should see ${google4Plus} businesses\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testRatingFilters();

