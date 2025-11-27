require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Review = require('../models/Review.model');

const MONGODB_URI = 'mongodb+srv://hashview2025:hashview@hashviewapp.fvr6ve4.mongodb.net/hashview?retryWrites=true&w=majority';

async function checkTodaysReviews() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const akash = await User.findOne({ name: /Akash Talukdar/i });

        // Check reviews from Nov 22, 2025
        const today = new Date('2025-11-22');
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date('2025-11-23');
        tomorrow.setHours(0, 0, 0, 0);

        const todaysReviews = await Review.find({
            user: akash._id,
            createdAt: { $gte: today, $lt: tomorrow }
        }).populate('business', 'name');

        console.log(`📅 Reviews from ${akash.name} on Nov 22, 2025:`);
        console.log(`   Total: ${todaysReviews.length}`);

        if (todaysReviews.length > 0) {
            todaysReviews.forEach((r, i) => {
                console.log(`\n   ${i + 1}. Review ID: ${r._id}`);
                console.log(`      Business: ${r.business.name}`);
                console.log(`      Rating: ${r.rating} ⭐`);
                console.log(`      Created: ${r.createdAt}`);
                console.log(`      Coupon Awarded: ${r.couponAwarded}`);
            });
        } else {
            console.log('   ❌ No reviews found for today (Nov 22, 2025)');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

checkTodaysReviews();
