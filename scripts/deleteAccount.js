/**
 * Script to delete a user account from User or BusinessOwner collection
 * Use this to clean up duplicate or test accounts
 * 
 * Usage: node scripts/deleteAccount.js <accountId>
 */

const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();

// Import models
const User = require('../models/User.model');
const BusinessOwner = require('../models/BusinessOwner.model');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function deleteAccount(accountId) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(60));
    console.log('DELETE ACCOUNT');
    console.log('='.repeat(60));

    // Try to find account in both collections
    let account = await User.findById(accountId);
    let collection = 'User';
    
    if (!account) {
      account = await BusinessOwner.findById(accountId);
      collection = 'BusinessOwner';
    }

    if (!account) {
      console.log(`\n❌ No account found with ID: ${accountId}`);
      console.log('   Please check the account ID and try again.\n');
      process.exit(1);
    }

    // Display account details
    console.log(`\n📋 Account Details:`);
    console.log('-'.repeat(60));
    console.log(`   Collection: ${collection}`);
    console.log(`   ID: ${account._id}`);
    console.log(`   Name: ${account.name}`);
    console.log(`   Email: ${account.email}`);
    console.log(`   Phone: ${account.phone}`);
    console.log(`   Role: ${account.role}`);
    console.log(`   Status: ${account.status}`);
    console.log(`   Created: ${account.createdAt}`);
    console.log('-'.repeat(60));

    // Ask for confirmation
    const answer = await askQuestion('\n⚠️  Are you sure you want to DELETE this account? (yes/no): ');
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Deletion cancelled.\n');
      process.exit(0);
    }

    // Delete the account
    if (collection === 'User') {
      await User.findByIdAndDelete(accountId);
    } else {
      await BusinessOwner.findByIdAndDelete(accountId);
    }

    console.log('\n✅ Account successfully deleted!\n');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log('\n❌ Usage: node scripts/deleteAccount.js <accountId>');
  console.log('\nExample:');
  console.log('  node scripts/deleteAccount.js 507f1f77bcf86cd799439011\n');
  process.exit(1);
}

const [accountId] = args;
deleteAccount(accountId);

