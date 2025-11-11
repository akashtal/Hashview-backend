/**
 * Fix Indulge Business Coordinates
 * 
 * Current (WRONG): [91.7351941, 26.1215109] (Near Jyotikuchi - same as J D CONSULTANCY)
 * Correct: [91.75168, 26.13352] (Lal Ganesh - actual location ~2.1km away)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Business = require('../models/Business.model');

async function fixIndulgeCoordinates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find Indulge business
    const indulge = await Business.findOne({ name: 'Indulge' });
    
    if (!indulge) {
      console.log('❌ Indulge business not found!');
      process.exit(1);
    }

    console.log('🏢 Current Indulge Data:');
    console.log(`   Name: ${indulge.name}`);
    console.log(`   Address: ${indulge.address.fullAddress}`);
    console.log(`   Current Coordinates: [${indulge.location.coordinates[0]}, ${indulge.location.coordinates[1]}]`);
    console.log(`   📍 Current: https://maps.google.com/?q=${indulge.location.coordinates[1]},${indulge.location.coordinates[0]}`);
    
    // Correct coordinates for Indulge (Lal Ganesh area)
    // Address: Rolling Mill, Lokhra Rd, above KFC, Ganapati Nagar, Lal Ganesh, Guwahati, Assam 781018
    const correctLongitude = 91.75168;
    const correctLatitude = 26.13352;
    
    console.log('\n🔧 Updating to Correct Coordinates:');
    console.log(`   New Coordinates: [${correctLongitude}, ${correctLatitude}]`);
    console.log(`   📍 New: https://maps.google.com/?q=${correctLatitude},${correctLongitude}`);
    
    // Calculate distance between old and new coordinates
    const { calculateDistance } = require('../utils/geolocation');
    const distanceMoved = calculateDistance(
      indulge.location.coordinates[1],
      indulge.location.coordinates[0],
      correctLatitude,
      correctLongitude
    );
    
    console.log(`   📏 Distance from old to new location: ${distanceMoved.toFixed(0)}m (~${(distanceMoved/1000).toFixed(2)}km)`);
    
    // Update coordinates
    indulge.location.coordinates = [correctLongitude, correctLatitude];
    
    await indulge.save();
    
    console.log('\n✅ Indulge coordinates updated successfully!');
    
    // Verify update
    const updated = await Business.findOne({ name: 'Indulge' });
    console.log('\n🔍 Verification:');
    console.log(`   Updated Coordinates: [${updated.location.coordinates[0]}, ${updated.location.coordinates[1]}]`);
    console.log(`   📍 Google Maps: https://maps.google.com/?q=${updated.location.coordinates[1]},${updated.location.coordinates[0]}`);
    
    // Test with user location
    console.log('\n🧪 Test with User Location:');
    const userLat = 26.12155;  // User at Jyotikuchi
    const userLon = 91.73502;
    
    const distanceToJD = calculateDistance(userLat, userLon, 26.1215421, 91.7350283);
    const distanceToIndulge = calculateDistance(userLat, userLon, correctLatitude, correctLongitude);
    
    console.log(`   User location: [${userLon}, ${userLat}] (Jyotikuchi)`);
    console.log(`   Distance to J D CONSULTANCY: ${distanceToJD.toFixed(1)}m (limit: 50m) → ${distanceToJD <= 50 ? '✅ ALLOW' : '❌ BLOCK'}`);
    console.log(`   Distance to Indulge: ${distanceToIndulge.toFixed(1)}m (limit: 50m) → ${distanceToIndulge <= 50 ? '✅ ALLOW' : '❌ BLOCK'}`);
    
    console.log('\n🎉 FIX COMPLETE!');
    console.log('Now user at Jyotikuchi can review J D CONSULTANCY but NOT Indulge!');
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixIndulgeCoordinates();

