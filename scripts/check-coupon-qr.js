require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Business = require('../models/Business.model');
const Coupon = require('../models/Coupon.model');

const MONGODB_URI = 'mongodb+srv://hashview2025:hashview@hashviewapp.fvr6ve4.mongodb.net/hashview?retryWrites=true&w=majority';

async function checkCouponQRCode() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find Akash
        const user = await User.findOne({ name: /Akash Talukdar/i });
        if (!user) {
            console.log('❌ User not found');
            return;
        }

        // Get Akash's latest coupon
        const latestCoupon = await Coupon.findOne({ user: user._id })
            .sort({ createdAt: -1 })
            .populate('business', 'name')
            .populate('user', 'name email');

        if (!latestCoupon) {
            console.log('❌ No coupon found for Akash');
            return;
        }

        console.log('📝 Latest Coupon for Akash Talukdar:');
        console.log(`   Coupon ID: ${latestCoupon._id}`);
        console.log(`   Code: ${latestCoupon.code}`);
        console.log(`   Business: ${latestCoupon.business.name}`);
        console.log(`   Status: ${latestCoupon.status}`);
        console.log(`   Created: ${latestCoupon.createdAt}`);
        console.log(`   Valid Until: ${latestCoupon.validUntil}`);
        console.log(`\n🔍 QR Code Data Check:`);

        if (latestCoupon.qrCodeData) {
            console.log(`   ✅ QR Code Data EXISTS`);
            console.log(`   Length: ${latestCoupon.qrCodeData.length} characters`);

            // Try to parse and display
            try {
                const parsed = JSON.parse(latestCoupon.qrCodeData);
                console.log(`\n   📊 QR Code Contents:`);
                console.log(`      Type: ${parsed.type}`);
                console.log(`      Coupon ID: ${parsed.couponId}`);
                console.log(`      Code: ${parsed.code}`);
                console.log(`      Business ID: ${parsed.businessId}`);
                console.log(`      User ID: ${parsed.userId}`);
                console.log(`      Review ID: ${parsed.reviewId || 'N/A'}`);
                console.log(`      Timestamp: ${parsed.timestamp}`);
            } catch (e) {
                console.log(`   ⚠️  QR Code Data exists but couldn't parse: ${e.message}`);
                console.log(`   Raw data: ${latestCoupon.qrCodeData.substring(0, 100)}...`);
            }
        } else {
            console.log(`   ❌ QR Code Data is MISSING`);
            console.log(`\n   This happened because the coupon was created via script,`);
            console.log(`   not through the API endpoint.`);
        }

        // Check all coupons for Akash
        const allCoupons = await Coupon.find({ user: user._id })
            .populate('business', 'name')
            .sort({ createdAt: -1 });

        console.log(`\n📊 All Coupons for Akash: ${allCoupons.length} total`);
        allCoupons.forEach((c, i) => {
            const hasQR = c.qrCodeData ? '✅ Has QR' : '❌ No QR';
            const isExpired = new Date(c.validUntil) < new Date() ? '(Expired)' : '(Active)';
            console.log(`   ${i + 1}. ${c.code} - ${c.business.name} - ${c.status} ${isExpired} - ${hasQR}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

checkCouponQRCode();
