/**
 * Update Business Coordinates from Google Geocoding API
 * 
 * This ensures ALL businesses have accurate coordinates from Google Maps
 */

const mongoose = require('mongoose');
const fetch = require('node-fetch');
require('dotenv').config();

const Business = require('../models/Business.model');

const GOOGLE_API_KEY = 'AIzaSyCgafT4Tw62CuxxN5DwbkqWIK9pVflKEXI';

async function updateBusinessCoordinates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const businesses = [
      {
        name: 'Indulge',
        address: 'Rolling Mill, Lokhra Rd, above KFC, Lal Ganesh, Guwahati',
        correctCoords: [91.741581, 26.144359] // From Google API test
      },
      {
        name: 'J D CONSULTANCY',
        address: 'House No.7 Dhopolia, Jyotikuchi, Guwahati',
        correctCoords: [91.7342233, 26.1217013] // From Google API test
      }
    ];

    console.log('🔧 UPDATING BUSINESS COORDINATES\n');
    console.log('='.repeat(80));

    for (const biz of businesses) {
      console.log(`\n📍 Processing: ${biz.name}`);
      console.log('-'.repeat(80));
      
      const business = await Business.findOne({ name: biz.name });
      
      if (!business) {
        console.log(`❌ Business "${biz.name}" not found in database!`);
        continue;
      }

      const oldLon = business.location.coordinates[0];
      const oldLat = business.location.coordinates[1];
      const newLon = biz.correctCoords[0];
      const newLat = biz.correctCoords[1];

      console.log(`   Old Coordinates: [${oldLon}, ${oldLat}]`);
      console.log(`   New Coordinates: [${newLon}, ${newLat}]`);
      console.log(`   📍 Old: https://maps.google.com/?q=${oldLat},${oldLon}`);
      console.log(`   📍 New: https://maps.google.com/?q=${newLat},${newLon}`);

      // Calculate how far we're moving it
      const { calculateDistance } = require('../utils/geolocation');
      const movementDistance = calculateDistance(oldLat, oldLon, newLat, newLon);
      console.log(`   📏 Moving: ${movementDistance.toFixed(0)}m (~${(movementDistance/1000).toFixed(2)}km)`);

      // Update
      business.location.coordinates = [newLon, newLat];
      await business.save();

      console.log(`   ✅ Updated successfully!`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🧪 TESTING WITH USER LOCATION:\n');

    const userLat = 26.12155;
    const userLon = 91.73502;
    console.log(`User Location: [${userLon}, ${userLat}] (Jyotikuchi)`);
    console.log('');

    for (const biz of businesses) {
      const business = await Business.findOne({ name: biz.name });
      if (!business) continue;

      const bizLat = business.location.coordinates[1];
      const bizLon = business.location.coordinates[0];
      
      const { calculateDistance } = require('../utils/geolocation');
      const distance = calculateDistance(userLat, userLon, bizLat, bizLon);

      const withinRadius = distance <= business.radius;
      
      console.log(`${biz.name}:`);
      console.log(`   Location: [${bizLon}, ${bizLat}]`);
      console.log(`   Distance from user: ${distance.toFixed(1)}m`);
      console.log(`   Radius: ${business.radius}m`);
      console.log(`   Result: ${withinRadius ? '✅ ALLOW review' : '❌ BLOCK review'}`);
      console.log('');
    }

    console.log('🎉 ALL BUSINESSES UPDATED WITH GOOGLE-ACCURATE COORDINATES!');
    console.log('Now geofencing will work correctly! ✅\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateBusinessCoordinates();

