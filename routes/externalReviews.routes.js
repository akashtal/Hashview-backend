const express = require('express');
const router = express.Router();
const {
  syncGoogleReviews,
  syncTripAdvisorReviews,
  getAllReviews
} = require('../controllers/externalReviews.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Sync external reviews (business owner or admin)
router.post('/:id/sync-google-reviews', protect, authorize('business', 'admin'), syncGoogleReviews);
router.post('/:id/sync-tripadvisor-reviews', protect, authorize('business', 'admin'), syncTripAdvisorReviews);

// Get all reviews (public)
router.get('/:id/all-reviews', getAllReviews);

module.exports = router;

