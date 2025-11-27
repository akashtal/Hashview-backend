require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Business = require('../models/Business.model');

const MONGODB_URI = 'mongodb+srv://hashview2025:hashview@hashviewapp.fvr6ve4.mongodb.net/hashview?retryWrites=true&w=majority';
const API_BASE_URL = 'http://localhost:5000/api';

async function createReviewToday() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const akash = await User.findOne({ name: /Akash Talukdar/i });
        const business = await Business.findOne();

        console.log(`👤 User: ${akash.name}`);
        console.log(`📍 Business: ${business.name}`);
        console.log(`📅 Today: November 22, 2025\n`);

        // Login
        console.log('🔐 Logging in...');
        const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: akash.email,
            password: 'Test@123'
        });

        console.log('✅ Login successful\n');

        // Create review
        const reviewData = {
            business: business._id.toString(),
            rating: 5,
            comment: 'Outstanding service and amazing experience! Highly recommended to everyone!',
            latitude: business.location.coordinates[1],
            longitude: business.location.coordinates[0],
            images: [],
            videos: [],
            locationAccuracy: 10,
            verificationTime: 25,
            motionDetected: true,
            isMockLocation: false,
            locationHistoryCount: 15,
            suspiciousActivities: [],
            deviceFingerprint: {
                deviceId: 'akash-phone-789',
                deviceName: 'Akash Device',
                manufacturer: 'Samsung',
                modelName: 'Galaxy S21',
                osName: 'Android',
                osVersion: '13',
                platform: 'android',
                isDevice: true
            },
            devicePlatform: 'android'
        };

        console.log('📝 Creating review via API...');
        const response = await axios.post(
            `${API_BASE_URL}/reviews`,
            reviewData,
            {
                headers: {
                    'Authorization': `Bearer ${loginResponse.data.token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.success) {
            console.log('\n🎉 SUCCESS! Review created via API!\n');
            console.log(`📝 Review:`);
            console.log(`   ID: ${response.data.review._id}`);
            console.log(`   Rating: ${response.data.review.rating} ⭐`);
            console.log(`   Status: ${response.data.review.status}`);

            if (response.data.coupon) {
                console.log(`\n💳 Coupon:`);
                console.log(`   ID: ${response.data.coupon._id}`);
                console.log(`   Code: ${response.data.coupon.code}`);
                console.log(`   Value: ${response.data.coupon.rewardValue}%`);
                console.log(`   Valid Until: ${new Date(response.data.coupon.validUntil).toLocaleString()}`);

                if (response.data.coupon.qrCodeData) {
                    const qr = JSON.parse(response.data.coupon.qrCodeData);
                    console.log(`\n✅ QR Code Generated!`);
                    console.log(`   Coupon ID: ${qr.couponId}`);
                    console.log(`   User ID: ${qr.userId}`);
                    console.log(`   Review ID: ${qr.reviewId}`);
                }
            }
        }

    } catch (error) {
        console.error('\n❌ Error:', error.response?.data?.message || error.message);
        if (error.response?.data) {
            console.error(JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected');
    }
}

createReviewToday();
