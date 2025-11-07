/**
 * Script to check for duplicate email/phone in User and BusinessOwner collections
 * Run this script to debug registration issues
 * 
 * Usage: node scripts/checkDuplicateAccounts.js <email> <phone>
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../models/User.model');
const BusinessOwner = require('../models/BusinessOwner.model');

async function checkDuplicates(email, phone) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(60));
    console.log('CHECKING FOR DUPLICATE ACCOUNTS');
    console.log('='.repeat(60));
    console.log(`\nEmail: ${email}`);
    console.log(`Phone: ${phone}\n`);

    // Check User collection
    const userByEmail = await User.findOne({ email });
    const userByPhone = await User.findOne({ phone });
    
    // Check BusinessOwner collection
    const businessOwnerByEmail = await BusinessOwner.findOne({ email });
    const businessOwnerByPhone = await BusinessOwner.findOne({ phone });

    // Display results
    console.log('RESULTS:');
    console.log('-'.repeat(60));
    
    if (userByEmail) {
      console.log('\n❌ EMAIL CONFLICT in User (Customer) Collection:');
      console.log(`   - ID: ${userByEmail._id}`);
      console.log(`   - Name: ${userByEmail.name}`);
      console.log(`   - Email: ${userByEmail.email}`);
      console.log(`   - Phone: ${userByEmail.phone}`);
      console.log(`   - Role: ${userByEmail.role}`);
      console.log(`   - Status: ${userByEmail.status}`);
      console.log(`   - Created: ${userByEmail.createdAt}`);
    }

    if (userByPhone) {
      console.log('\n❌ PHONE CONFLICT in User (Customer) Collection:');
      console.log(`   - ID: ${userByPhone._id}`);
      console.log(`   - Name: ${userByPhone.name}`);
      console.log(`   - Email: ${userByPhone.email}`);
      console.log(`   - Phone: ${userByPhone.phone}`);
      console.log(`   - Role: ${userByPhone.role}`);
      console.log(`   - Status: ${userByPhone.status}`);
      console.log(`   - Created: ${userByPhone.createdAt}`);
    }

    if (businessOwnerByEmail) {
      console.log('\n❌ EMAIL CONFLICT in BusinessOwner Collection:');
      console.log(`   - ID: ${businessOwnerByEmail._id}`);
      console.log(`   - Name: ${businessOwnerByEmail.name}`);
      console.log(`   - Email: ${businessOwnerByEmail.email}`);
      console.log(`   - Phone: ${businessOwnerByEmail.phone}`);
      console.log(`   - Role: ${businessOwnerByEmail.role}`);
      console.log(`   - Status: ${businessOwnerByEmail.status}`);
      console.log(`   - Created: ${businessOwnerByEmail.createdAt}`);
    }

    if (businessOwnerByPhone) {
      console.log('\n❌ PHONE CONFLICT in BusinessOwner Collection:');
      console.log(`   - ID: ${businessOwnerByPhone._id}`);
      console.log(`   - Name: ${businessOwnerByPhone.name}`);
      console.log(`   - Email: ${businessOwnerByPhone.email}`);
      console.log(`   - Phone: ${businessOwnerByPhone.phone}`);
      console.log(`   - Role: ${businessOwnerByPhone.role}`);
      console.log(`   - Status: ${businessOwnerByPhone.status}`);
      console.log(`   - Created: ${businessOwnerByPhone.createdAt}`);
    }

    if (!userByEmail && !userByPhone && !businessOwnerByEmail && !businessOwnerByPhone) {
      console.log('\n✅ NO CONFLICTS FOUND!');
      console.log('   This email and phone number are available for registration.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\nSUGGESTED ACTIONS:');
    console.log('-'.repeat(60));
    
    if (userByEmail || userByPhone || businessOwnerByEmail || businessOwnerByPhone) {
      console.log('\n1. If you own these accounts:');
      console.log('   - Use the LOGIN feature instead of registration');
      console.log('   - Use "Forgot Password" if you don\'t remember your password');
      
      console.log('\n2. If you want to create a new account:');
      console.log('   - Use a different email address');
      console.log('   - Use a different phone number');
      
      console.log('\n3. If these are duplicate/test accounts you want to delete:');
      console.log('   - Run: node scripts/deleteAccount.js <account_id>');
      console.log('   - Or manually delete from MongoDB');
    }
    
    console.log('\n' + '='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('\n❌ Usage: node scripts/checkDuplicateAccounts.js <email> <phone>');
  console.log('\nExample:');
  console.log('  node scripts/checkDuplicateAccounts.js user@example.com 1234567890\n');
  process.exit(1);
}

const [email, phone] = args;
checkDuplicates(email, phone);

