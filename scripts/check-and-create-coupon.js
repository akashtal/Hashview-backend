require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const User = require('../models/User.model');
const Business = require('../models/Business.model');
const Review = require('../models/Review.model');
const Coupon = require('../models/Coupon.model');

const MONGODB_URI = 'mongodb+srv://hashview2025:hashview@hashviewapp.fvr6ve4.mongodb.net/hashview?retryWrites=true&w=majority';

// Helper function to generate coupon code
function generateCouponCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function checkAndCreateCoupon() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find Akash's latest review
        const user = await User.findOne({ name: /Akash Talukdar/i });
        if (!user) {
            console.log('❌ User not found');
            return;
        }

        const latestReview = await Review.findOne({ user: user._id })
            .sort({ createdAt: -1 })
            .populate('business', 'name');

        console.log(`📝 Latest Review from ${user.name}:`);
        console.log(`   Business: ${latestReview.business.name}`);
        console.log(`   Rating: ${latestReview.rating} ⭐`);
        console.log(`   Created: ${latestReview.createdAt}`);
        console.log(`   Coupon Awarded: ${latestReview.couponAwarded}`);

        // Check if coupon already exists for this review
        const existingCoupon = await Coupon.findOne({ review: latestReview._id });

        if (existingCoupon) {
            console.log(`\n✅ Coupon already exists for this review:`);
            console.log(`   Coupon ID: ${existingCoupon._id}`);
            console.log(`   Code: ${existingCoupon.code}`);
            console.log(`   Type: ${existingCoupon.rewardType}`);
            console.log(`   Value: ${existingCoupon.rewardValue}`);
            console.log(`   Status: ${existingCoupon.status}`);
            console.log(`   Valid Until: ${existingCoupon.validUntil}`);
            return;
        }

        console.log(`\n⚠️  No coupon found for this review. Creating one...\n`);

        // Get coupon template for this business
        const couponTemplate = await Coupon.findOne({
            business: latestReview.business._id,
            type: 'business',
            isActive: true
        });

        // Generate coupon code and expiry
        const couponCode = generateCouponCode();
        const couponExpiry = new Date();
        couponExpiry.setHours(couponExpiry.getHours() + 2); // 2 hours validity

        // Use template values or defaults
        const rewardType = couponTemplate?.rewardType || 'percentage';
        const rewardValue = couponTemplate?.rewardValue || 10;
        const description = couponTemplate?.description || 'Thank you for your review! Enjoy your reward. Valid for 2 hours.';
        const minPurchaseAmount = couponTemplate?.minPurchaseAmount || 0;
        const maxDiscountAmount = couponTemplate?.maxDiscountAmount || null;

        // Create coupon
        const coupon = await Coupon.create({
            type: 'review_reward',
            business: latestReview.business._id,
            user: user._id,
            review: latestReview._id,
            code: couponCode,
            rewardType,
            rewardValue,
            description,
            validFrom: new Date(),
            validUntil: couponExpiry,
            minPurchaseAmount,
            maxDiscountAmount,
            status: 'active',
            terms: 'Valid for 2 hours from time of issue. Can be used once.'
        });

        // Generate QR code data
        const qrCodeData = JSON.stringify({
            type: 'coupon',
            couponId: coupon._id.toString(),
            code: couponCode,
            businessId: latestReview.business._id.toString(),
            userId: user._id.toString(),
            reviewId: latestReview._id.toString(),
            timestamp: new Date().toISOString()
        });

        // Update coupon with QR code data
        coupon.qrCodeData = qrCodeData;
        await coupon.save();

        // Update review to mark coupon as awarded
        latestReview.couponAwarded = true;
        latestReview.coupon = coupon._id;
        await latestReview.save();

        console.log('✅ Coupon created successfully!');
        console.log(`   Coupon ID: ${coupon._id}`);
        console.log(`   Code: ${coupon.code}`);
        console.log(`   Type: ${coupon.rewardType}`);
        console.log(`   Value: ${coupon.rewardValue}${rewardType === 'percentage' ? '%' : '₹'}`);
        console.log(`   Description: ${coupon.description}`);
        console.log(`   Status: ${coupon.status}`);
        console.log(`   Valid From: ${coupon.validFrom}`);
        console.log(`   Valid Until: ${coupon.validUntil}`);
        console.log(`   Min Purchase: ₹${coupon.minPurchaseAmount}`);

        // Check all coupons for this user
        const allUserCoupons = await Coupon.find({ user: user._id })
            .populate('business', 'name')
            .sort({ createdAt: -1 });

        console.log(`\n📊 All Coupons for ${user.name}: ${allUserCoupons.length} total`);
        allUserCoupons.forEach((c, i) => {
            console.log(`   ${i + 1}. ${c.code} - ${c.business.name} - ${c.status} - Expires: ${c.validUntil.toLocaleString()}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

checkAndCreateCoupon();
