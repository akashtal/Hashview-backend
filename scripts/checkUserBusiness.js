/**
 * Check if a user already has a registered business
 * Usage: node scripts/checkUserBusiness.js <email>
 */

const mongoose = require('mongoose');
require('dotenv').config();

const BusinessOwner = require('../models/BusinessOwner.model');
const User = require('../models/User.model');
const Business = require('../models/Business.model');

async function checkUserBusiness(email) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n✅ Connected to MongoDB\n');
    
    // Find user
    let user = await BusinessOwner.findOne({ email });
    let userType = 'BusinessOwner';
    
    if (!user) {
      user = await User.findOne({ email });
      userType = 'User';
    }
    
    if (!user) {
      console.log('❌ No user found with email:', email);
      process.exit(1);
    }
    
    console.log('👤 User Found:');
    console.log('   Collection:', userType);
    console.log('   ID:', user._id);
    console.log('   Name:', user.name);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Status:', user.status);
    
    // Check for businesses
    const businesses = await Business.find({ owner: user._id });
    
    console.log('\n🏢 Businesses Registered:', businesses.length);
    
    if (businesses.length > 0) {
      console.log('\n📋 Business Details:');
      businesses.forEach((biz, index) => {
        console.log(`\n   Business ${index + 1}:`);
        console.log('   - ID:', biz._id);
        console.log('   - Name:', biz.name);
        console.log('   - Email:', biz.email);
        console.log('   - Phone:', biz.phone);
        console.log('   - Category:', biz.category);
        console.log('   - Status:', biz.status);
        console.log('   - KYC Status:', biz.kycStatus);
        console.log('   - Created:', biz.createdAt);
      });
      
      console.log('\n⚠️  This user ALREADY has a registered business!');
      console.log('   Business owners can only register ONE business.');
      console.log('\n   Solutions:');
      console.log('   1. Use the existing business');
      console.log('   2. Delete the existing business first');
      console.log('   3. Create a new business owner account');
    } else {
      console.log('\n✅ This user has NO registered business.');
      console.log('   They can register a new business.');
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

const email = process.argv[2];

if (!email) {
  console.log('\n❌ Usage: node scripts/checkUserBusiness.js <email>');
  console.log('\nExample:');
  console.log('  node scripts/checkUserBusiness.js businessowner@test.com\n');
  process.exit(1);
}

checkUserBusiness(email);

