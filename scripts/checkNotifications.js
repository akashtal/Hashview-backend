require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('../models/Notification.model');
const User = require('../models/User.model');
const BusinessOwner = require('../models/BusinessOwner.model');

async function checkNotifications() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check total notifications
    const totalNotifications = await Notification.countDocuments();
    console.log(`\n📊 Total Notifications in DB: ${totalNotifications}`);

    // Check recent notifications
    const recentNotifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('sentTo')
      .populate('sentBy', 'name email');

    console.log('\n📬 Recent Notifications:');
    recentNotifications.forEach((notif, index) => {
      console.log(`\n${index + 1}. ${notif.title}`);
      console.log(`   Type: ${notif.type}`);
      console.log(`   Recipient Type: ${notif.recipientType || 'N/A'}`);
      console.log(`   Sent To: ${notif.sentTo?.name || notif.sentTo?._id || 'Unknown'} (${notif.sentToModel || 'User'})`);
      console.log(`   Sent By: ${notif.sentBy?.name || 'System'}`);
      console.log(`   Status: ${notif.status}`);
      console.log(`   Created: ${notif.createdAt}`);
    });

    // Check admin broadcast notifications
    const adminBroadcasts = await Notification.countDocuments({ type: 'admin_broadcast' });
    console.log(`\n📢 Admin Broadcast Notifications: ${adminBroadcasts}`);

    // Check users
    const totalUsers = await User.countDocuments({ role: 'customer', status: 'active' });
    const usersWithTokens = await User.countDocuments({ 
      role: 'customer', 
      status: 'active',
      pushToken: { $exists: true, $ne: null }
    });
    console.log(`\n👥 Users: ${totalUsers} active (${usersWithTokens} with push tokens)`);

    // Check business owners
    const totalBusinessOwners = await BusinessOwner.countDocuments({ status: 'active' });
    const ownersWithTokens = await BusinessOwner.countDocuments({ 
      status: 'active',
      pushToken: { $exists: true, $ne: null }
    });
    console.log(`🏢 Business Owners: ${totalBusinessOwners} active (${ownersWithTokens} with push tokens)`);

    // Check notifications by recipient type
    const notifsByType = await Notification.aggregate([
      {
        $group: {
          _id: '$recipientType',
          count: { $sum: 1 }
        }
      }
    ]);
    console.log('\n📊 Notifications by Recipient Type:');
    notifsByType.forEach(item => {
      console.log(`   ${item._id || 'individual'}: ${item.count}`);
    });

    mongoose.connection.close();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkNotifications();

