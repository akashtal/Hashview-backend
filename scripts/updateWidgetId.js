/**
 * Helper Script: Update Common Ninja Widget ID for a Business
 * 
 * This script allows you to easily add/update the Common Ninja widget ID
 * for a specific business in MongoDB.
 * 
 * Usage:
 * node scripts/updateWidgetId.js <businessId> <widgetId>
 * 
 * Example:
 * node scripts/updateWidgetId.js 690b9bf1db73e89a9bc9fdc1 8670ae7a-ce18-4666-b98b-37f17d17c52c
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../models/Business.model');

async function updateWidgetId(businessId, widgetId) {
  try {
    console.log('\n🔧 Common Ninja Widget ID Update Tool\n');
    console.log('═══════════════════════════════════════════════════\n');

    // Validate inputs
    if (!businessId || !widgetId) {
      console.error('❌ Error: Both businessId and widgetId are required\n');
      console.log('Usage: node scripts/updateWidgetId.js <businessId> <widgetId>\n');
      console.log('Example:');
      console.log('  node scripts/updateWidgetId.js 690b9bf1db73e89a9bc9fdc1 8670ae7a-ce18-4666-b98b-37f17d17c52c\n');
      process.exit(1);
    }

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find business
    console.log(`🔍 Finding business: ${businessId}`);
    const business = await Business.findById(businessId);

    if (!business) {
      console.error(`❌ Business not found with ID: ${businessId}\n`);
      process.exit(1);
    }

    console.log(`✅ Found business: ${business.name}\n`);

    // Update widget ID
    console.log('📝 Updating widget ID...');
    
    if (!business.externalProfiles) business.externalProfiles = {};
    if (!business.externalProfiles.tripAdvisor) business.externalProfiles.tripAdvisor = {};

    business.externalProfiles.tripAdvisor.commonNinjaWidgetId = widgetId;
    business.externalProfiles.tripAdvisor.commonNinjaWidgetUrl = `https://widgets.commoninja.com/${widgetId}`;

    await business.save();

    console.log('✅ Widget ID updated successfully!\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 Updated Business Details:');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Business Name: ${business.name}`);
    console.log(`Business ID: ${business._id}`);
    console.log(`Widget ID: ${business.externalProfiles.tripAdvisor.commonNinjaWidgetId}`);
    console.log(`Widget URL: ${business.externalProfiles.tripAdvisor.commonNinjaWidgetUrl}`);
    
    if (business.externalProfiles.tripAdvisor.profileUrl) {
      console.log(`TripAdvisor URL: ${business.externalProfiles.tripAdvisor.profileUrl}`);
    }
    
    console.log('═══════════════════════════════════════════════════\n');
    console.log('🎉 Done! You can now sync TripAdvisor rating in the app.\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get command line arguments
const businessId = process.argv[2];
const widgetId = process.argv[3];

updateWidgetId(businessId, widgetId);

