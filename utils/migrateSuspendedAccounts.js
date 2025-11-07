/**
 * Utility script to migrate existing suspended users to SuspendedAccount collection
 * Run this if you have users with status='suspended' but no SuspendedAccount record
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User.model');
const BusinessOwner = require('../models/BusinessOwner.model');
const SuspendedAccount = require('../models/SuspendedAccount.model');

async function migrateSuspendedAccounts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all suspended users
    const suspendedUsers = await User.find({ status: 'suspended' });
    console.log(`📊 Found ${suspendedUsers.length} suspended users`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of suspendedUsers) {
      try {
        // Check if SuspendedAccount record already exists
        const existing = await SuspendedAccount.findOne({
          email: user.email.toLowerCase()
        });

        if (existing) {
          console.log(`⏭️  Skipping ${user.email} - already has SuspendedAccount record`);
          skippedCount++;
          continue;
        }

        // Create SuspendedAccount record
        await SuspendedAccount.create({
          email: user.email.toLowerCase(),
          accountType: 'user',
          originalAccountId: user._id,
          suspendedBy: new mongoose.Types.ObjectId(), // Dummy admin ID for migration
          reason: 'Migrated from existing suspended account',
          status: 'suspended'
        });

        console.log(`✅ Migrated ${user.email}`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Error migrating ${user.email}:`, error.message);
        errorCount++;
      }
    }

    // Find all suspended business owners
    const suspendedBusinessOwners = await BusinessOwner.find({ status: 'suspended' });
    console.log(`📊 Found ${suspendedBusinessOwners.length} suspended business owners`);

    for (const owner of suspendedBusinessOwners) {
      try {
        // Check if SuspendedAccount record already exists
        const existing = await SuspendedAccount.findOne({
          email: owner.email.toLowerCase()
        });

        if (existing) {
          console.log(`⏭️  Skipping ${owner.email} - already has SuspendedAccount record`);
          skippedCount++;
          continue;
        }

        // Create SuspendedAccount record
        await SuspendedAccount.create({
          email: owner.email.toLowerCase(),
          accountType: 'businessOwner',
          originalAccountId: owner._id,
          suspendedBy: new mongoose.Types.ObjectId(), // Dummy admin ID for migration
          reason: 'Migrated from existing suspended account',
          status: 'suspended'
        });

        console.log(`✅ Migrated ${owner.email}`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Error migrating ${owner.email}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    await mongoose.connection.close();
    console.log('\n✅ Migration completed');
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateSuspendedAccounts()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = migrateSuspendedAccounts;

