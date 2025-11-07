/**
 * Seed Initial Categories - Run this once as admin
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category.model');

// Default categories (admin can modify/delete these later)
const categories = [
  { name: 'Restaurant', icon: 'restaurant', color: '#EF4444', order: 1, description: 'Restaurants and dining establishments' },
  { name: 'Café', icon: 'cafe', color: '#F59E0B', order: 2, description: 'Coffee shops and cafés' },
  { name: 'Hotel', icon: 'bed', color: '#8B5CF6', order: 3, description: 'Hotels and accommodations' },
  { name: 'Retail', icon: 'cart', color: '#3B82F6', order: 4, description: 'Shops and retail stores' },
  { name: 'Services', icon: 'construct', color: '#10B981', order: 5, description: 'Service providers' },
  { name: 'Healthcare', icon: 'medical', color: '#EC4899', order: 6, description: 'Medical and healthcare' },
  { name: 'Education', icon: 'school', color: '#6366F1', order: 7, description: 'Schools and educational institutions' },
  { name: 'Entertainment', icon: 'film', color: '#F97316', order: 8, description: 'Entertainment venues' }
];

async function seedCategories() {
  try {
    console.log('\n🌱 Seeding Categories...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Note: You'll need an admin user ID
    const adminId = process.env.ADMIN_ID || '000000000000000000000000'; // Replace with actual admin ID

    console.log('Creating categories...\n');

    let created = 0;
    let skipped = 0;

    for (const cat of categories) {
      const existing = await Category.findOne({ name: cat.name });
      
      if (existing) {
        console.log(`⏩ Skipped "${cat.name}" (already exists)`);
        skipped++;
      } else {
        await Category.create({
          ...cat,
          createdBy: adminId
        });
        console.log(`✅ Created "${cat.name}" (${cat.icon}, ${cat.color})`);
        created++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`✅ Created: ${created} categories`);
    console.log(`⏩ Skipped: ${skipped} categories (already exist)`);
    console.log('═══════════════════════════════════════════════════\n');

    // Show all categories
    const allCategories = await Category.find().sort({ order: 1 });
    console.log('📋 All Categories:\n');
    allCategories.forEach(cat => {
      console.log(`   ${cat.order}. ${cat.name} (${cat.slug}) - ${cat.icon} ${cat.color}`);
    });
    console.log('');

    console.log('🎉 Seeding complete!\n');
    console.log('Next steps:');
    console.log('1. Admin can now manage categories via API');
    console.log('2. Categories will appear in mobile app automatically');
    console.log('3. Businesses can select these categories during registration\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error seeding categories:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedCategories();

