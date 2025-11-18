const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

const Business = require('../models/Business.model');
const User = require('../models/User.model');

const EARTH_RADIUS_METERS = 6371e3;

const toRadians = (deg) => (deg * Math.PI) / 180;

function haversineDistance({ latitude: lat1, longitude: lon1 }, { latitude: lat2, longitude: lon2 }) {
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return null;
  }

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function formatDistance(distanceMeters) {
  if (distanceMeters === null) {
    return 'N/A';
  }
  if (distanceMeters < 1000) {
    return `${distanceMeters.toFixed(2)} m`;
  }
  return `${(distanceMeters / 1000).toFixed(3)} km`;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hashview';

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected\n');

  const businesses = await Business.find({}, 'name location').limit(2);
  const users = await User.find({}, 'name location role').limit(2);

  if (businesses.length < 2) {
    console.log(`⚠️  Expected at least 2 businesses, found ${businesses.length}.`);
  }
  if (users.length < 2) {
    console.log(`⚠️  Expected at least 2 users, found ${users.length}.`);
  }

  const entityInfo = [
    ...businesses.map((biz, index) => ({
      label: `Business ${index + 1}: ${biz.name}`,
      type: 'business',
      coordinates: {
        latitude: biz.location?.coordinates?.[1],
        longitude: biz.location?.coordinates?.[0],
      },
    })),
    ...users.map((usr, index) => ({
      label: `User ${index + 1}: ${usr.name} (${usr.role})`,
      type: 'user',
      coordinates: {
        latitude: usr.location?.coordinates?.[1],
        longitude: usr.location?.coordinates?.[0],
      },
    })),
  ];

  console.log('📌 Entities considered:');
  entityInfo.forEach((entity) => {
    const { latitude, longitude } = entity.coordinates;
    console.log(`- ${entity.label}`);
    console.log(
      `  Coordinates: ${
        latitude !== undefined && longitude !== undefined
          ? `[${latitude.toFixed(6)}, ${longitude.toFixed(6)}]`
          : 'N/A'
      }`
    );
  });
  console.log('\n📏 Distance Matrix:\n');

  for (let i = 0; i < entityInfo.length; i += 1) {
    for (let j = i + 1; j < entityInfo.length; j += 1) {
      const distance = haversineDistance(entityInfo[i].coordinates, entityInfo[j].coordinates);
      console.log(
        `${entityInfo[i].label} ↔ ${entityInfo[j].label} = ${formatDistance(distance)}`
      );
    }
  }

  await mongoose.disconnect();
  console.log('\n✅ Distance calculation complete.');
}

main().catch((error) => {
  console.error('❌ Error calculating distances:', error);
  mongoose.disconnect();
  process.exit(1);
});

