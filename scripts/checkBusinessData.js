const mongoose = require('mongoose');
require('dotenv').config();

async function checkBusinessData() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hashview';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected!\n');

    const Business = require('../models/Business.model.js');

    // Get all active businesses
    const businesses = await Business.find({ status: 'active' });
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📊 ACTIVE BUSINESSES IN DATABASE: ${businesses.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    businesses.forEach((business, index) => {
      console.log(`${index + 1}. ${business.name}`);
      console.log(`   Status: ${business.status}`);
      console.log(`   Category: ${business.category}`);
      console.log(`   Address:`);
      console.log(`     - Full: ${business.address?.fullAddress}`);
      console.log(`     - City: ${business.address?.city}`);
      console.log(`     - Area: ${business.address?.area}`);
      console.log(`   Ratings:`);
      console.log(`     - HashView: ${business.rating?.average || 0} (${business.rating?.count || 0} reviews)`);
      console.log(`     - Google: ${business.externalProfiles?.googleBusiness?.rating || 'N/A'}`);
      console.log(`     - TripAdvisor: ${business.externalProfiles?.tripAdvisor?.rating || 'N/A'}`);
      console.log(`   External Profiles:`);
      console.log(`     ${JSON.stringify(business.externalProfiles || {}, null, 2)}`);
      console.log('');
    });

    // Test search query
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 TESTING SEARCH QUERIES');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Test 1: Search by first business name
    if (businesses.length > 0) {
      const testName = businesses[0].name.substring(0, 3);
      console.log(`Test 1: Searching for "${testName}"`);
      const result1 = await Business.find({
        status: 'active',
        $or: [
          { name: { $regex: testName, $options: 'i' } },
          { 'address.city': { $regex: testName, $options: 'i' } }
        ]
      });
      console.log(`  ✅ Found ${result1.length} businesses`);
      result1.forEach(b => console.log(`     - ${b.name}`));
    }

    // Test 2: Google rating filter
    console.log('\nTest 2: Filter by Google 4+ rating');
    const result2 = await Business.find({
      status: 'active',
      'externalProfiles.googleBusiness.rating': { $gte: 4 }
    });
    console.log(`  ✅ Found ${result2.length} businesses with Google 4+ rating`);
    result2.forEach(b => {
      console.log(`     - ${b.name}: ${b.externalProfiles?.googleBusiness?.rating}`);
    });

    // Test 3: HashView rating filter
    console.log('\nTest 3: Filter by HashView 4+ rating');
    const result3 = await Business.find({
      status: 'active',
      'rating.average': { $gte: 4 }
    });
    console.log(`  ✅ Found ${result3.length} businesses with HashView 4+ rating`);
    result3.forEach(b => {
      console.log(`     - ${b.name}: ${b.rating?.average}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Done!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkBusinessData();

