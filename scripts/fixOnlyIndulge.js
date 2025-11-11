/**
 * Fix ONLY Indulge coordinates (keep J D CONSULTANCY as-is)
 * 
 * Indulge coordinates from Google Places API (actual business location)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Business = require('../models/Business.model');

async function fixOnlyIndulge() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find Indulge
    const indulge = await Business.findOne({ name: 'Indulge' });
    
    if (!indulge) {
      console.log('❌ Indulge not found!');
      process.exit(1);
    }

    console.log('🏢 Indulge - Current Data:');
    console.log(`   Current Coordinates: [${indulge.location.coordinates[0]}, ${indulge.location.coordinates[1]}]`);
    
    // Correct coordinates from Google Places API
    // Place ID: ChIJ6fVl239bWjcRTP3vcS_WTXg
    const correctLon = 91.741581;
    const correctLat = 26.144359;
    
    // Calculate movement
    const { calculateDistance } = require('../utils/geolocation');
    const oldDistance = calculateDistance(
      indulge.location.coordinates[1],
      indulge.location.coordinates[0],
      correctLat,
      correctLon
    );
    
    console.log(`   New Coordinates: [${correctLon}, ${correctLat}]`);
    console.log(`   Moving: ${oldDistance.toFixed(0)}m`);
    console.log(`   📍 New location: https://maps.google.com/?q=${correctLat},${correctLon}`);
    
    // Update
    indulge.location.coordinates = [correctLon, correctLat];
    await indulge.save();
    
    console.log(`\n✅ Indulge updated!`);
    
    // Test with user location
    const userLat = 26.12155;
    const userLon = 91.73502;
    
    const distanceFromUser = calculateDistance(userLat, userLon, correctLat, correctLon);
    
    console.log(`\n🧪 TEST:`);
    console.log(`   User at: [${userLon}, ${userLat}] (Jyotikuchi)`);
    console.log(`   Indulge at: [${correctLon}, ${correctLat}] (Lal Ganesh)`);
    console.log(`   Distance: ${distanceFromUser.toFixed(0)}m`);
    console.log(`   Radius: ${indulge.radius}m`);
    console.log(`   Result: ${distanceFromUser <= indulge.radius ? '✅ ALLOW' : '❌ BLOCK'}`);
    
    console.log('\n🎉 Indulge now has correct Google Maps coordinates!');
    console.log('User from Jyotikuchi will be BLOCKED from reviewing Indulge! ✅\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixOnlyIndulge();

