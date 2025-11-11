const mongoose = require('mongoose');
require('dotenv').config();

async function addSearchIndexes() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hashview';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected!\n');

    const Business = require('../models/Business.model.js');

    console.log('📊 Adding search indexes for optimal performance...\n');

    // Text index for full-text search across multiple fields
    console.log('1. Creating text index for name, description, and address fields...');
    await Business.collection.createIndex({
      name: 'text',
      description: 'text',
      'address.fullAddress': 'text',
      'address.city': 'text',
      'address.area': 'text',
      'address.state': 'text'
    }, {
      name: 'business_search_text_index',
      weights: {
        name: 10,              // Name is most important
        'address.city': 5,     // City is important
        'address.area': 3,     // Area is moderately important
        description: 2,        // Description is less important
        'address.fullAddress': 2,
        'address.state': 1
      }
    });
    console.log('✅ Text index created\n');

    // Compound index for status + rating (for sorting)
    console.log('2. Creating compound index for status and rating...');
    await Business.collection.createIndex(
      { status: 1, 'rating.average': -1 },
      { name: 'business_status_rating_index' }
    );
    console.log('✅ Compound index created\n');

    // Compound index for status + category (for filtering)
    console.log('3. Creating compound index for status and category...');
    await Business.collection.createIndex(
      { status: 1, category: 1 },
      { name: 'business_status_category_index' }
    );
    console.log('✅ Compound index created\n');

    // Index for city searches
    console.log('4. Creating index for city searches...');
    await Business.collection.createIndex(
      { 'address.city': 1 },
      { name: 'business_city_index' }
    );
    console.log('✅ City index created\n');

    // List all indexes
    console.log('📋 All indexes on Business collection:');
    const indexes = await Business.collection.indexes();
    indexes.forEach((index, i) => {
      console.log(`   ${i + 1}. ${index.name}`);
      console.log(`      Keys:`, JSON.stringify(index.key));
    });

    await mongoose.connection.close();
    console.log('\n✅ Done! Search performance optimized.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addSearchIndexes();

