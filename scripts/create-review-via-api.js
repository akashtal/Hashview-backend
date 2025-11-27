require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Business = require('../models/Business.model');

const MONGODB_URI = 'mongodb+srv://hashview2025:hashview@hashviewapp.fvr6ve4.mongodb.net/hashview?retryWrites=true&w=majority';
const API_BASE_URL = 'http://localhost:5000/api';

async function createReviewViaAPI() {
    try {
        // Connect to MongoDB to get user and business info
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find Akash
        const user = await User.findOne({ name: /Akash Talukdar/i });
        if (!user) {
            console.log('❌ User not found');
            return;
        }
        console.log(`👤 User: ${user.name} (${user.email})`);

        // Find business
        const business = await Business.findOne();
        if (!business) {
            console.log('❌ Business not found');
            return;
        }
        console.log(`📍 Business: ${business.name}`);
        console.log(`   Location: [${business.location.coordinates[0]}, ${business.location.coordinates[1]}]`);

        // Get user's JWT token (we need to login first)
        console.log('\n🔐 Logging in as Akash...');

        // First, let's get/create a password for Akash
        // We'll use a simple password for testing
        const loginData = {
            email: user.email,
            password: 'Test@123' // You may need to update this in the database
        };

        let token;
        try {
            const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, loginData);
            token = loginResponse.data.token;
            console.log('✅ Login successful');
        } catch (loginError) {
            console.log('⚠️  Login failed. User might not have a password set.');
            console.log('   Error:', loginError.response?.data?.message || loginError.message);
            console.log('\n💡 Alternative: Creating review with admin token or updating user password...');

            // Try to find admin user
            const admin = await User.findOne({ role: 'admin' });
            if (admin) {
                console.log('\n🔐 Trying admin login instead...');
                const adminLogin = {
                    email: admin.email,
                    password: process.env.ADMIN_PASSWORD || 'Admin@123'
                };

                try {
                    const adminLoginResponse = await axios.post(`${API_BASE_URL}/auth/login`, adminLogin);
                    token = adminLoginResponse.data.token;
                    console.log('✅ Admin login successful');
                    console.log('⚠️  Note: Creating review as admin, not as Akash');
                } catch (adminError) {
                    console.log('❌ Admin login also failed:', adminError.response?.data?.message || adminError.message);
                    return;
                }
            } else {
                console.log('❌ No admin user found');
                return;
            }
        }

        // Prepare review data
        const reviewData = {
            business: business._id.toString(),
            rating: 5,
            comment: 'Fantastic experience! The service was outstanding and I highly recommend this place to everyone. Will definitely come back again!',
            latitude: business.location.coordinates[1], // Business location (for geofencing)
            longitude: business.location.coordinates[0],
            images: [],
            videos: [],
            // Security metadata (simulated)
            locationAccuracy: 10,
            verificationTime: 30,
            motionDetected: true,
            isMockLocation: false,
            locationHistoryCount: 10,
            suspiciousActivities: [],
            deviceFingerprint: {
                deviceId: 'test-device-123',
                deviceName: 'Test Device',
                manufacturer: 'Test',
                modelName: 'Test Model',
                osName: 'Android',
                osVersion: '13',
                platform: 'android',
                isDevice: true
            },
            devicePlatform: 'android'
        };

        console.log('\n📝 Creating review via API...');
        console.log(`   Rating: ${reviewData.rating} ⭐`);
        console.log(`   Comment: ${reviewData.comment.substring(0, 50)}...`);

        // Call the API to create review
        const response = await axios.post(
            `${API_BASE_URL}/reviews`,
            reviewData,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.success) {
            console.log('\n✅ Review created successfully via API!');
            console.log(`   Review ID: ${response.data.review._id}`);
            console.log(`   Rating: ${response.data.review.rating} ⭐`);
            console.log(`   Status: ${response.data.review.status}`);

            if (response.data.coupon) {
                console.log('\n🎉 Coupon automatically generated!');
                console.log(`   Coupon ID: ${response.data.coupon._id}`);
                console.log(`   Code: ${response.data.coupon.code}`);
                console.log(`   Type: ${response.data.coupon.rewardType}`);
                console.log(`   Value: ${response.data.coupon.rewardValue}${response.data.coupon.rewardType === 'percentage' ? '%' : '₹'}`);
                console.log(`   Status: ${response.data.coupon.status}`);
                console.log(`   Valid Until: ${response.data.coupon.validUntil}`);

                if (response.data.coupon.qrCodeData) {
                    console.log(`\n✅ QR Code Data: PRESENT`);
                    console.log(`   Length: ${response.data.coupon.qrCodeData.length} characters`);

                    try {
                        const qrData = JSON.parse(response.data.coupon.qrCodeData);
                        console.log(`\n   📊 QR Code Contents:`);
                        console.log(`      Type: ${qrData.type}`);
                        console.log(`      Coupon ID: ${qrData.couponId}`);
                        console.log(`      Code: ${qrData.code}`);
                        console.log(`      User ID: ${qrData.userId}`);
                        console.log(`      Business ID: ${qrData.businessId}`);
                    } catch (e) {
                        console.log(`   ⚠️  Could not parse QR data`);
                    }
                } else {
                    console.log(`\n❌ QR Code Data: MISSING`);
                }
            } else {
                console.log('\n⚠️  No coupon was generated');
            }
        }

    } catch (error) {
        console.error('\n❌ Error:', error.response?.data || error.message);
        if (error.response?.data) {
            console.error('   Details:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

createReviewViaAPI();
