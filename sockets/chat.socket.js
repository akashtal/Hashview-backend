const Chat = require('../models/Chat.model');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Store online users
const onlineUsers = new Map();

module.exports = (io) => {
  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userId}`);

    // Add user to online users
    onlineUsers.set(socket.userId, socket.id);
    
    // Notify others that user is online
    socket.broadcast.emit('user_online', { userId: socket.userId });

    // Join user's personal room
    socket.join(`user_${socket.userId}`);

    // Handle typing indicator
    socket.on('typing', (data) => {
      const { receiverId } = data;
      const receiverSocketId = onlineUsers.get(receiverId);
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user_typing', {
          userId: socket.userId,
          isTyping: true
        });
      }
    });

    socket.on('stop_typing', (data) => {
      const { receiverId } = data;
      const receiverSocketId = onlineUsers.get(receiverId);
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user_typing', {
          userId: socket.userId,
          isTyping: false
        });
      }
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { receiverId, message, messageType, fileUrl } = data;

        // Save message to database
        const chat = await Chat.create({
          sender: socket.userId,
          receiver: receiverId,
          message,
          messageType: messageType || 'text',
          fileUrl,
          status: 'sent'
        });

        await chat.populate('sender', 'name profileImage');
        await chat.populate('receiver', 'name profileImage');

        // Send to receiver if online
        const receiverSocketId = onlineUsers.get(receiverId);
        
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('receive_message', chat);
          
          // Update status to delivered
          chat.status = 'delivered';
          await chat.save();
        }

        // Send confirmation to sender
        socket.emit('message_sent', {
          success: true,
          chat
        });

      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('message_error', {
          success: false,
          message: 'Failed to send message'
        });
      }
    });

    // Handle message read status
    socket.on('mark_as_read', async (data) => {
      try {
        const { messageId } = data;

        const chat = await Chat.findById(messageId);
        
        if (chat && chat.receiver.toString() === socket.userId) {
          chat.status = 'read';
          chat.readAt = new Date();
          await chat.save();

          // Notify sender
          const senderSocketId = onlineUsers.get(chat.sender.toString());
          if (senderSocketId) {
            io.to(senderSocketId).emit('message_read', {
              messageId,
              readAt: chat.readAt
            });
          }
        }
      } catch (error) {
        logger.error('Error marking message as read:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
      onlineUsers.delete(socket.userId);
      
      // Notify others that user is offline
      socket.broadcast.emit('user_offline', { userId: socket.userId });
    });
  });

  // Return online users for external use
  return {
    getOnlineUsers: () => onlineUsers,
    isUserOnline: (userId) => onlineUsers.has(userId)
  };
};

