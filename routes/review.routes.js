const express = require('express');
const router = express.Router();
const {
  createReview,
  getBusinessReviews,
  getReview,
  updateReview,
  deleteReview,
  markHelpful,
  getSuspiciousActivities,
  getFlaggedReviews,
  clearSuspiciousActivities
} = require('../controllers/review.controller');
const { protect, optionalAuth, authorize } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validation');

// Admin routes (must be before parameterized routes)
router.get('/admin/suspicious-activities', protect, authorize('admin'), getSuspiciousActivities);
router.get('/admin/flagged', protect, authorize('admin'), getFlaggedReviews);
router.delete('/admin/suspicious-activities', protect, authorize('admin'), clearSuspiciousActivities);

// Public routes
router.get('/business/:businessId', optionalAuth, getBusinessReviews);
router.get('/:id', getReview);

// Protected routes
router.post('/', protect, validate(schemas.createReview), createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);
router.post('/:id/helpful', protect, markHelpful);

module.exports = router;

