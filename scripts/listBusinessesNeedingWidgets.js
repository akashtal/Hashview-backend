/**
 * Helper Script: List Businesses That Need Common Ninja Widget IDs
 * 
 * This script finds all businesses that have a TripAdvisor URL but
 * are missing the Common Ninja widget ID.
 * 
 * Usage:
 * node scripts/listBusinessesNeedingWidgets.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../models/Business.model');

async function listBusinessesNeedingWidgets() {
  try {
    console.log('\n🔍 Finding Businesses That Need Widget IDs\n');
    console.log('═══════════════════════════════════════════════════\n');

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find businesses with TripAdvisor URL but no widget ID
    const businesses = await Business.find({
      'externalProfiles.tripAdvisor.profileUrl': { $exists: true, $ne: null, $ne: '' },
      $or: [
        { 'externalProfiles.tripAdvisor.commonNinjaWidgetId': { $exists: false } },
        { 'externalProfiles.tripAdvisor.commonNinjaWidgetId': null },
        { 'externalProfiles.tripAdvisor.commonNinjaWidgetId': '' }
      ]
    }).select('name email externalProfiles.tripAdvisor.profileUrl status');

    if (businesses.length === 0) {
      console.log('✅ All businesses with TripAdvisor URLs have widget IDs configured!\n');
      process.exit(0);
    }

    console.log(`📋 Found ${businesses.length} business(es) that need widget IDs:\n`);
    console.log('═══════════════════════════════════════════════════\n');

    businesses.forEach((business, index) => {
      console.log(`${index + 1}. ${business.name}`);
      console.log(`   Business ID: ${business._id}`);
      console.log(`   Email: ${business.email || 'N/A'}`);
      console.log(`   Status: ${business.status}`);
      console.log(`   TripAdvisor URL: ${business.externalProfiles?.tripAdvisor?.profileUrl}`);
      console.log('');
      console.log(`   ➡️  To add widget ID, run:`);
      console.log(`   node scripts/updateWidgetId.js ${business._id} YOUR_WIDGET_ID`);
      console.log('\n' + '─'.repeat(50) + '\n');
    });

    console.log('═══════════════════════════════════════════════════');
    console.log('📝 Next Steps:');
    console.log('═══════════════════════════════════════════════════');
    console.log('1. Go to: https://www.commoninja.com/dashboard');
    console.log('2. Create a TripAdvisor Reviews widget for each business');
    console.log('3. Get the widget ID from each widget');
    console.log('4. Run the updateWidgetId script for each business');
    console.log('═══════════════════════════════════════════════════\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listBusinessesNeedingWidgets();

