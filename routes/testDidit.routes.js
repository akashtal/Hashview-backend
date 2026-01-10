const express = require('express');
const router = express.Router();
const { testDiditAuth } = require('../controllers/testDidit.controller');

// Test Didit API authentication
// GET /api/test-didit
router.get('/', testDiditAuth);

module.exports = router;

