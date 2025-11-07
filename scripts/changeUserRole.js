/**
 * Script to change a user's role
 * Useful for testing role-based routing
 * 
 * Usage: node scripts/changeUserRole.js <accountId> <newRole>
 */

const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();

const User = require('../models/User.model');
const BusinessOwner = require('../models/BusinessOwner.model');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function changeUserRole(accountId, newRole) {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(60));
    console.log('CHANGE USER ROLE');
    console.log('='.repeat(60));

    // Find account in User collection
    let account = await User.findById(accountId);
    let currentCollection = 'User';
    
    if (!account) {
      account = await BusinessOwner.findById(accountId);
      currentCollection = 'BusinessOwner';
    }

    if (!account) {
      console.log(`\n❌ No account found with ID: ${accountId}`);
      console.log('   Please check the account ID and try again.\n');
      process.exit(1);
    }

    console.log(`\n📋 Current Account Details:`);
    console.log('-'.repeat(60));
    console.log(`   Collection: ${currentCollection}`);
    console.log(`   ID: ${account._id}`);
    console.log(`   Name: ${account.name}`);
    console.log(`   Email: ${account.email}`);
    console.log(`   Phone: ${account.phone}`);
    console.log(`   Current Role: ${account.role}`);
    console.log(`   Status: ${account.status}`);
    console.log('-'.repeat(60));

    // Validate new role
    const validRoles = {
      'User': ['customer', 'admin'],
      'BusinessOwner': ['business']
    };

    if (currentCollection === 'User') {
      if (!validRoles.User.includes(newRole)) {
        console.log(`\n❌ Invalid role for User collection. Valid roles: ${validRoles.User.join(', ')}`);
        console.log(`   To change to 'business' role, account needs to be migrated to BusinessOwner collection.`);
        process.exit(1);
      }
    } else {
      if (!validRoles.BusinessOwner.includes(newRole)) {
        console.log(`\n❌ Invalid role for BusinessOwner collection. Only 'business' role is valid.`);
        console.log(`   To change to 'customer' or 'admin', account needs to be migrated to User collection.`);
        process.exit(1);
      }
    }

    if (account.role === newRole) {
      console.log(`\n⚠️  Account already has role: ${newRole}`);
      process.exit(0);
    }

    console.log(`\n📝 Proposed Change:`);
    console.log(`   ${account.role} → ${newRole}`);

    const answer = await askQuestion('\n⚠️  Are you sure you want to change this role? (yes/no): ');
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Operation cancelled.\n');
      process.exit(0);
    }

    // Update role
    account.role = newRole;
    await account.save();

    console.log('\n✅ Role successfully updated!\n');
    console.log('Updated Account:');
    console.log('-'.repeat(60));
    console.log(`   ID: ${account._id}`);
    console.log(`   Name: ${account.name}`);
    console.log(`   Email: ${account.email}`);
    console.log(`   New Role: ${account.role}`);
    console.log('-'.repeat(60));
    
    console.log('\n⚠️  IMPORTANT: User needs to logout and login again for changes to take effect!\n');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('\n❌ Usage: node scripts/changeUserRole.js <accountId> <newRole>');
  console.log('\nValid roles:');
  console.log('  - customer  (for User collection)');
  console.log('  - business  (for BusinessOwner collection)');
  console.log('  - admin     (for User collection)');
  console.log('\nExample:');
  console.log('  node scripts/changeUserRole.js 507f1f77bcf86cd799439011 customer\n');
  process.exit(1);
}

const [accountId, newRole] = args;
changeUserRole(accountId, newRole);

