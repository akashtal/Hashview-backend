require('dotenv').config();
const mongoose = require('mongoose');
const Review = require('../models/Review.model');
const User = require('../models/User.model');
const Business = require('../models/Business.model');

const MONGODB_URI = 'mongodb+srv://hashview2025:hashview@hashviewapp.fvr6ve4.mongodb.net/hashview?retryWrites=true&w=majority';

async function viewReviews() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const reviews = await Review.find()
            .populate('user', 'name email')
            .populate('business', 'name')
            .sort({ createdAt: -1 })
            .limit(5);

        console.log(`📝 Latest ${reviews.length} Reviews:\n`);

        reviews.forEach((r, i) => {
            console.log(`${i + 1}. ${r.user.name} reviewed "${r.business.name}"`);
            console.log(`   Rating: ${r.rating} ⭐`);
            console.log(`   Comment: ${r.comment}`);
            console.log(`   Status: ${r.status}`);
            console.log(`   Created: ${r.createdAt}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

viewReviews();
