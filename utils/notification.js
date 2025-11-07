const { Expo } = require('expo-server-sdk');
const Notification = require('../models/Notification.model');
const logger = require('./logger');

// Create a new Expo SDK client
const expo = new Expo();

// Send push notification
exports.sendPushNotification = async (userId, title, message, data = {}) => {
  try {
    // Create notification record
    const notification = await Notification.create({
      title,
      message,
      sentTo: userId,
      type: data.type || 'general',
      data,
      status: 'pending'
    });

    // Get user's push token
    const User = require('../models/User.model');
    const user = await User.findById(userId);

    if (!user || !user.pushToken) {
      notification.status = 'failed';
      notification.errorMessage = 'User push token not found';
      await notification.save();
      return { success: false, message: 'Push token not found' };
    }

    // Check that push token is valid
    if (!Expo.isExpoPushToken(user.pushToken)) {
      notification.status = 'failed';
      notification.errorMessage = 'Invalid push token format';
      await notification.save();
      return { success: false, message: 'Invalid push token' };
    }

    // Construct message
    const messages = [{
      to: user.pushToken,
      sound: 'default',
      title,
      body: message,
      data: data,
      priority: 'high'
    }];

    // Send notifications
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        logger.error('Error sending push notification chunk:', error);
      }
    }

    // Update notification status
    if (tickets.length > 0 && tickets[0].status === 'ok') {
      notification.status = 'sent';
      notification.expoTicketId = tickets[0].id;
    } else {
      notification.status = 'failed';
      notification.errorMessage = tickets[0]?.message || 'Unknown error';
    }

    await notification.save();

    return { success: true, notification, tickets };
  } catch (error) {
    logger.error('Error in sendPushNotification:', error);
    return { success: false, message: error.message };
  }
};

// Send notification to multiple users
exports.sendBulkNotifications = async (userIds, title, message, data = {}) => {
  const results = await Promise.allSettled(
    userIds.map(userId => this.sendPushNotification(userId, title, message, data))
  );
  return results;
};

// Check notification receipts
exports.checkNotificationReceipts = async () => {
  try {
    const notifications = await Notification.find({
      status: 'sent',
      expoTicketId: { $exists: true }
    });

    if (notifications.length === 0) return;

    const receiptIds = notifications.map(n => n.expoTicketId);
    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

    for (let chunk of receiptIdChunks) {
      try {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

        for (let [receiptId, receipt] of Object.entries(receipts)) {
          const notification = notifications.find(n => n.expoTicketId === receiptId);
          
          if (!notification) continue;

          if (receipt.status === 'error') {
            notification.status = 'failed';
            notification.errorMessage = receipt.message;
          }

          await notification.save();
        }
      } catch (error) {
        logger.error('Error checking notification receipts:', error);
      }
    }
  } catch (error) {
    logger.error('Error in checkNotificationReceipts:', error);
  }
};

