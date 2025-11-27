require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const User = require('../models/User.model');
const Business = require('../models/Business.model');
const Review = require('../models/Review.model');

const MONGODB_URI = 'mongodb+srv://hashview2025:hashview@hashviewapp.fvr6ve4.mongodb.net/hashview?retryWrites=true&w=majority';

async function addReview() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get all users
        const users = await User.find().limit(5);
        console.log(`📊 Found ${users.length} users in database:`);
        users.forEach((u, i) => {
            console.log(`  ${i + 1}. ${u.name} (${u.email}) - Role: ${u.role}`);
        });

        // Get all businesses
        const businesses = await Business.find().limit(5);
        console.log(`\n📊 Found ${businesses.length} businesses in database:`);
        businesses.forEach((b, i) => {
            console.log(`  ${i + 1}. ${b.name} - Status: ${b.kycStatus}`);
        });

        if (users.length === 0) {
            console.log('\n❌ No users found. Please create a user first.');
            return;
        }

        if (businesses.length === 0) {
            console.log('\n❌ No businesses found. Please create a business first.');
            return;
        }

        // Use first user and first business
        const user = users[0];
        const business = businesses[0];

        console.log(`\n🎯 Creating review:`);
        console.log(`   User: ${user.name}`);
        console.log(`   Business: ${business.name}`);

        // Check if review already exists
        const existingReview = await Review.findOne({
            user: user._id,
            business: business._id
        });

        if (existingReview) {
            console.log('\n⚠️  Review already exists from this user for this business');
            console.log(`   Review ID: ${existingReview._id}`);
            console.log(`   Rating: ${existingReview.rating} stars`);
            console.log(`   Comment: ${existingReview.comment}`);
            console.log(`   Created: ${existingReview.createdAt}`);
            return;
        }

        // Create a new review
        const reviewData = {
            user: user._id,
            business: business._id,
            rating: 5,
            comment: 'Amazing experience! The service was excellent and the staff was very friendly. Highly recommend this place to everyone!',
            images: [],
            videos: [],
            geolocation: {
                type: 'Point',
                coordinates: business.location?.coordinates || [0, 0] // [longitude, latitude]
            },
            verified: true,
            status: 'approved'
        };

        const review = await Review.create(reviewData);
        console.log('\n✅ Review created successfully!');
        console.log(`   Review ID: ${review._id}`);
        console.log(`   Rating: ${review.rating} ⭐`);
        console.log(`   Comment: ${review.comment}`);
        console.log(`   Status: ${review.status}`);

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

addReview();
