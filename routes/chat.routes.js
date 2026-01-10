const express = require('express');
const router = express.Router();
const {
  getChatHistory,
  sendMessage,
  getChatList
} = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes are protected
router.use(protect);

router.get('/conversations', getChatList);
router.get('/:userId', getChatHistory);
router.post('/', sendMessage);

module.exports = router;

