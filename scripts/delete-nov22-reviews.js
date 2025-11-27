require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Review = require('../models/Review.model');
const Business = require('../models/Business.model');

const MONGODB_URI = 'mongodb+srv://hashview2025:hashview@hashviewapp.fvr6ve4.mongodb.net/hashview?retryWrites=true&w=majority';

async function deleteNov22Reviews() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected\n');

        const akash = await User.findOne({ name: /Akash/i });

        // Nov 22, 2025 range
        const nov22Start = new Date('2025-11-22T00:00:00Z');
        const nov23Start = new Date('2025-11-23T00:00:00Z');

        const reviews = await Review.find({
            user: akash._id,
            createdAt: { $gte: nov22Start, $lt: nov23Start }
        }).populate('business', 'name');

        console.log(`Found ${reviews.length} reviews from Nov 22:`);
        reviews.forEach(r => {
            console.log(`  - ${r._id} for ${r.business.name} at ${r.createdAt}`);
        });

        if (reviews.length > 0) {
            const result = await Review.deleteMany({
                user: akash._id,
                createdAt: { $gte: nov22Start, $lt: nov23Start }
            });
            console.log(`\n✅ Deleted ${result.deletedCount} reviews`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected');
    }
}

deleteNov22Reviews();
