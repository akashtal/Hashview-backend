require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const User = require('../models/User.model');
const Business = require('../models/Business.model');
const Review = require('../models/Review.model');

const MONGODB_URI = 'mongodb+srv://hashview2025:hashview@hashviewapp.fvr6ve4.mongodb.net/hashview?retryWrites=true&w=majority';

async function addReviewFromAkash() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find user by name "Akash Talukdar"
        const user = await User.findOne({ name: /Akash Talukdar/i });
        if (!user) {
            console.log('❌ User "Akash Talukdar" not found in database');
            return;
        }
        console.log(`👤 Found User: ${user.name} (${user.email})`);

        // Get first business
        const business = await Business.findOne();
        if (!business) {
            console.log('❌ No business found in database');
            return;
        }
        console.log(`📍 Business: ${business.name}`);

        // Check if review exists from this user for this business TODAY
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayReview = await Review.findOne({
            user: user._id,
            business: business._id,
            createdAt: { $gte: today }
        });

        if (todayReview) {
            console.log('\n⚠️  Akash already reviewed this business TODAY');
            console.log(`   Review ID: ${todayReview._id}`);
            console.log(`   Created: ${todayReview.createdAt}`);
            return;
        }

        // Check all reviews from this user for this business
        const allReviews = await Review.find({
            user: user._id,
            business: business._id
        }).sort({ createdAt: -1 });

        console.log(`\n📊 Existing reviews from ${user.name} for ${business.name}:`);
        if (allReviews.length > 0) {
            allReviews.forEach((r, i) => {
                console.log(`   ${i + 1}. ${r.rating}⭐ - ${r.createdAt.toLocaleDateString()}`);
            });
            console.log(`\n✅ Last review was on ${allReviews[0].createdAt.toLocaleDateString()}`);
            console.log(`   Today is ${new Date().toLocaleDateString()}`);
            console.log(`   ✅ Can submit new review (different day)!\n`);
        } else {
            console.log('   No previous reviews found\n');
        }

        // Create a new review with varied content
        const reviewComments = [
            'Outstanding service and great ambiance! The attention to detail was impressive. Will definitely visit again!',
            'Exceptional experience from start to finish. The staff went above and beyond to ensure everything was perfect.',
            'Absolutely loved it! The quality exceeded my expectations. Highly recommended for anyone looking for top-notch service.',
            'Fantastic place with wonderful atmosphere. Everything was well-organized and the team was very professional.',
            'One of the best experiences I\'ve had! The service was impeccable and the overall quality was superb.'
        ];

        const randomComment = reviewComments[Math.floor(Math.random() * reviewComments.length)];
        const randomRating = Math.floor(Math.random() * 2) + 4; // 4 or 5 stars

        const reviewData = {
            user: user._id,
            business: business._id,
            rating: randomRating,
            comment: randomComment,
            images: [],
            videos: [],
            geolocation: {
                type: 'Point',
                coordinates: business.location?.coordinates || [0, 0]
            },
            verified: true,
            status: 'approved'
        };

        const review = await Review.create(reviewData);
        console.log('✅ Review created successfully!');
        console.log(`   Review ID: ${review._id}`);
        console.log(`   User: ${user.name}`);
        console.log(`   Business: ${business.name}`);
        console.log(`   Rating: ${review.rating} ⭐`);
        console.log(`   Comment: ${review.comment}`);
        console.log(`   Status: ${review.status}`);
        console.log(`   Created: ${review.createdAt}`);

        // Update business rating
        const reviews = await Review.find({ business: business._id, status: 'approved' });
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = totalRating / reviews.length;

        await Business.findByIdAndUpdate(business._id, {
            rating: averageRating,
            reviewCount: reviews.length
        });

        console.log(`\n📊 Business "${business.name}" updated:`);
        console.log(`   Average Rating: ${averageRating.toFixed(2)} ⭐`);
        console.log(`   Total Reviews: ${reviews.length}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

addReviewFromAkash();
