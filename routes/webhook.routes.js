const express = require('express');
const router = express.Router();
const { handleDiditWebhook } = require('../controllers/verification.controller');

// Didit webhook endpoint (public but signature verified)
router.post('/didit', handleDiditWebhook);

module.exports = router;

