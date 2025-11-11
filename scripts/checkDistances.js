const mongoose = require('mongoose');
require('dotenv').config();

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

async function checkDistances() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hashview';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected!\n');

    const Business = require('../models/Business.model.js');

    const businesses = await Business.find({}, 'name location address').limit(10);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📍 BUSINESSES IN DATABASE');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    businesses.forEach((business, index) => {
      const lat = business.location.coordinates[1];
      const lon = business.location.coordinates[0];
      console.log(`${index + 1}. ${business.name}`);
      console.log(`   📍 Address: ${business.address?.fullAddress || 'N/A'}`);
      if (business.address) {
        if (business.address.street) console.log(`      Street: ${business.address.street}`);
        if (business.address.area) console.log(`      Area: ${business.address.area}`);
        if (business.address.city) console.log(`      City: ${business.address.city}`);
        if (business.address.state) console.log(`      State: ${business.address.state}`);
        if (business.address.pincode) console.log(`      PIN: ${business.address.pincode}`);
        if (business.address.landmark) console.log(`      Landmark: ${business.address.landmark}`);
      }
      console.log(`   🌐 Coordinates: [${lon.toFixed(6)}, ${lat.toFixed(6)}]`);
      console.log(`   📐 Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`);
      console.log('');
    });

    if (businesses.length >= 2) {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('📏 DISTANCE CALCULATIONS');
      console.log('═══════════════════════════════════════════════════════════\n');

      const business1 = businesses[0];
      const business2 = businesses[1];

      const lat1 = business1.location.coordinates[1];
      const lon1 = business1.location.coordinates[0];
      const lat2 = business2.location.coordinates[1];
      const lon2 = business2.location.coordinates[0];

      const distanceBetweenBusinesses = calculateDistance(lat1, lon1, lat2, lon2);

      console.log(`🏢 DISTANCE #1: Between "${business1.name}" and "${business2.name}"`);
      console.log(`   ${distanceBetweenBusinesses.toFixed(2)} meters (${(distanceBetweenBusinesses / 1000).toFixed(3)} km)`);
      console.log('');

      // Your location (example)
      const yourLat = 26.1443594;
      const yourLon = 91.7415812;

      console.log(`👤 YOUR LOCATION (Example):`);
      console.log(`   📍 Lal Ganesh, Guwahati`);
      console.log(`   📐 Lat: ${yourLat}, Lon: ${yourLon}\n`);

      const yourDistanceToBusiness1 = calculateDistance(yourLat, yourLon, lat1, lon1);
      const yourDistanceToBusiness2 = calculateDistance(yourLat, yourLon, lat2, lon2);

      console.log(`📍 DISTANCE #2: YOU → "${business1.name}"`);
      console.log(`   ${yourDistanceToBusiness1.toFixed(2)} meters (${(yourDistanceToBusiness1 / 1000).toFixed(3)} km)`);
      console.log(`   Geofence (≤50m): ${yourDistanceToBusiness1 <= 50 ? '✅ PASS' : '❌ FAIL (too far)'}`);
      console.log('');

      console.log(`📍 DISTANCE #3: YOU → "${business2.name}"`);
      console.log(`   ${yourDistanceToBusiness2.toFixed(2)} meters (${(yourDistanceToBusiness2 / 1000).toFixed(3)} km)`);
      console.log(`   Geofence (≤50m): ${yourDistanceToBusiness2 <= 50 ? '✅ PASS' : '❌ FAIL (too far)'}`);
      console.log('');

      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('🔍 THE THREE DIFFERENCES EXPLAINED');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      console.log('1️⃣  BUSINESS-TO-BUSINESS DISTANCE:');
      console.log(`    📏 ${(distanceBetweenBusinesses / 1000).toFixed(2)} km`);
      console.log('    📊 Purpose: Market analysis, competitor mapping');
      console.log('    👤 Involves User? NO - Static business geography');
      console.log('    🎯 Used For: Admin dashboards, analytics\n');

      console.log('2️⃣  USER-TO-BUSINESS-1 DISTANCE:');
      console.log(`    📏 ${(yourDistanceToBusiness1 / 1000).toFixed(2)} km`);
      console.log('    📊 Purpose: Geofencing validation');
      console.log('    👤 Involves User? YES - Changes as you move');
      console.log('    🎯 Used For: Review submission blocking');
      console.log(`    🚦 Status: ${yourDistanceToBusiness1 <= 50 ? '✅ Can review' : '❌ Cannot review'}\n`);

      console.log('3️⃣  USER-TO-BUSINESS-2 DISTANCE:');
      console.log(`    📏 ${(yourDistanceToBusiness2 / 1000).toFixed(2)} km`);
      console.log('    📊 Purpose: Geofencing validation');
      console.log('    👤 Involves User? YES - Changes as you move');
      console.log('    🎯 Used For: Review submission blocking');
      console.log(`    🚦 Status: ${yourDistanceToBusiness2 <= 50 ? '✅ Can review' : '❌ Cannot review'}\n`);

      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('📊 SUMMARY TABLE');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      console.log('┌─────────┬─────────────────┬─────────────────┬──────────┬─────────────┐');
      console.log('│ Type    │ From            │ To              │ Distance │ Geofencing? │');
      console.log('├─────────┼─────────────────┼─────────────────┼──────────┼─────────────┤');
      console.log(`│ Dist #1 │ ${business1.name.padEnd(15).substring(0,15)} │ ${business2.name.padEnd(15).substring(0,15)} │ ${(distanceBetweenBusinesses/1000).toFixed(2).padStart(6)} km │ ❌ No       │`);
      console.log(`│ Dist #2 │ YOU (user)      │ ${business1.name.padEnd(15).substring(0,15)} │ ${(yourDistanceToBusiness1/1000).toFixed(2).padStart(6)} km │ ✅ Yes      │`);
      console.log(`│ Dist #3 │ YOU (user)      │ ${business2.name.padEnd(15).substring(0,15)} │ ${(yourDistanceToBusiness2/1000).toFixed(2).padStart(6)} km │ ✅ Yes      │`);
      console.log('└─────────┴─────────────────┴─────────────────┴──────────┴─────────────┘');
      
    } else {
      console.log(`⚠️  Only ${businesses.length} business(es) found.`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Done!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDistances();

