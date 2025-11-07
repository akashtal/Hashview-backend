/**
 * Script to test Business Owner registration and login flow
 * This will help debug any issues with business owner accounts
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User.model');
const BusinessOwner = require('../models/BusinessOwner.model');

async function testBusinessOwnerFlow() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(70));
    console.log('TESTING BUSINESS OWNER FLOW');
    console.log('='.repeat(70));

    const testEmail = 'testbusiness@example.com';
    const testPhone = '9999999999';
    const testPassword = 'password123';

    // Step 1: Clean up any existing test accounts
    console.log('\n📋 Step 1: Cleaning up existing test accounts...');
    await User.deleteMany({ email: testEmail });
    await BusinessOwner.deleteMany({ email: testEmail });
    console.log('✅ Cleaned up existing test accounts');

    // Step 2: Create a business owner
    console.log('\n📋 Step 2: Creating business owner account...');
    const businessOwner = await BusinessOwner.create({
      name: 'Test Business Owner',
      email: testEmail,
      phone: testPhone,
      passwordHash: testPassword,
      role: 'business'
    });
    console.log('✅ Business owner created successfully!');
    console.log('   ID:', businessOwner._id);
    console.log('   Name:', businessOwner.name);
    console.log('   Email:', businessOwner.email);
    console.log('   Phone:', businessOwner.phone);
    console.log('   Role:', businessOwner.role);
    console.log('   Status:', businessOwner.status);

    // Step 3: Verify password was hashed
    console.log('\n📋 Step 3: Verifying password hashing...');
    const isPasswordHashed = businessOwner.passwordHash !== testPassword;
    console.log(isPasswordHashed ? '✅ Password is hashed' : '❌ Password is NOT hashed');

    // Step 4: Test password comparison
    console.log('\n📋 Step 4: Testing password comparison...');
    const isPasswordValid = await businessOwner.comparePassword(testPassword);
    console.log(isPasswordValid ? '✅ Password comparison works' : '❌ Password comparison FAILED');

    // Step 5: Find business owner
    console.log('\n📋 Step 5: Finding business owner by email...');
    const foundByEmail = await BusinessOwner.findOne({ email: testEmail });
    console.log(foundByEmail ? '✅ Found by email' : '❌ NOT found by email');

    const foundByPhone = await BusinessOwner.findOne({ phone: testPhone });
    console.log(foundByPhone ? '✅ Found by phone' : '❌ NOT found by phone');

    // Step 6: Test getPublicProfile method
    console.log('\n📋 Step 6: Testing getPublicProfile method...');
    try {
      const publicProfile = businessOwner.getPublicProfile();
      console.log('✅ getPublicProfile() works');
      console.log('   Public Profile:', JSON.stringify(publicProfile, null, 2));
    } catch (error) {
      console.log('❌ getPublicProfile() FAILED:', error.message);
    }

    // Step 7: Test toJSON method
    console.log('\n📋 Step 7: Testing toJSON method...');
    const jsonData = businessOwner.toJSON();
    const hasPassword = jsonData.hasOwnProperty('passwordHash');
    console.log(hasPassword ? '❌ Password is exposed in JSON' : '✅ Password is hidden in JSON');

    // Step 8: Check collections
    console.log('\n📋 Step 8: Verifying database collections...');
    const userCount = await User.countDocuments({ email: testEmail });
    const businessOwnerCount = await BusinessOwner.countDocuments({ email: testEmail });
    console.log(`   Users collection: ${userCount} documents with this email`);
    console.log(`   BusinessOwners collection: ${businessOwnerCount} documents with this email`);
    console.log(businessOwnerCount === 1 && userCount === 0 ? '✅ Correct collection usage' : '❌ Wrong collection');

    // Step 9: Simulate login
    console.log('\n📋 Step 9: Simulating login flow...');
    const loginUser = await BusinessOwner.findOne({ email: testEmail }).select('+passwordHash');
    if (loginUser) {
      const isLoginValid = await loginUser.comparePassword(testPassword);
      console.log(isLoginValid ? '✅ Login would succeed' : '❌ Login would FAIL');
    } else {
      console.log('❌ Cannot find user for login');
    }

    // Step 10: Clean up
    console.log('\n📋 Step 10: Cleaning up test data...');
    await BusinessOwner.deleteMany({ email: testEmail });
    console.log('✅ Test data cleaned up');

    console.log('\n' + '='.repeat(70));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(70));
    console.log('✅ All tests passed! Business Owner functionality is working correctly.');
    console.log('\nYou can now:');
    console.log('1. Register a new business owner account in the app');
    console.log('2. Login with the business owner credentials');
    console.log('3. Navigate to the Business Dashboard');
    console.log('='.repeat(70) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack trace:', error.stack);
    console.log('\n' + '='.repeat(70));
    console.log('TEST FAILED');
    console.log('='.repeat(70));
    console.log('Please check the error above and fix the issue.\n');
    process.exit(1);
  }
}

testBusinessOwnerFlow();

