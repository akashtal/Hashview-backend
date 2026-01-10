const Chat = require('../models/Chat.model');
const User = require('../models/User.model');

// @desc    Get chat history
// @route   GET /api/chat/:userId
// @access  Private
exports.getChatHistory = async (req, res, next) => {
  try {
    const otherUserId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Chat.find({
      $or: [
        { sender: req.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user.id }
      ]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'name profileImage')
      .populate('receiver', 'name profileImage');

    const total = await Chat.countDocuments({
      $or: [
        { sender: req.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user.id }
      ]
    });

    // Mark messages as read
    await Chat.updateMany(
      { sender: otherUserId, receiver: req.user.id, status: { $ne: 'read' } },
      { status: 'read', readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      messages: messages.reverse()
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send message
// @route   POST /api/chat
// @access  Private
exports.sendMessage = async (req, res, next) => {
  try {
    const { receiver, message, messageType, fileUrl } = req.body;

    // Check if receiver exists
    const receiverUser = await User.findById(receiver);
    if (!receiverUser) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }

    const chat = await Chat.create({
      sender: req.user.id,
      receiver,
      message,
      messageType: messageType || 'text',
      fileUrl,
      status: 'sent'
    });

    await chat.populate('sender', 'name profileImage');
    await chat.populate('receiver', 'name profileImage');

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      chat
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get chat list (all conversations)
// @route   GET /api/chat/conversations
// @access  Private
exports.getChatList = async (req, res, next) => {
  try {
    const conversations = await Chat.aggregate([
      {
        $match: {
          $or: [
            { sender: req.user._id },
            { receiver: req.user._id }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', req.user._id] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$message' },
          lastMessageTime: { $first: '$createdAt' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', req.user._id] },
                    { $ne: ['$status', 'read'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { lastMessageTime: -1 }
      }
    ]);

    // Populate user details
    await User.populate(conversations, {
      path: '_id',
      select: 'name profileImage email'
    });

    res.status(200).json({
      success: true,
      count: conversations.length,
      conversations
    });
  } catch (error) {
    next(error);
  }
};

