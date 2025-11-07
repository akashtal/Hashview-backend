const express = require('express');
const router = express.Router();
const {
  createReview,
  getBusinessReviews,
  getReview,
  updateReview,
  deleteReview,
  markHelpful
} = require('../controllers/review.controller');
const { protect, optionalAuth } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validation');

// Public routes
router.get('/business/:businessId', optionalAuth, getBusinessReviews);
router.get('/:id', getReview);

// Protected routes
router.post('/', protect, validate(schemas.createReview), createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);
router.post('/:id/helpful', protect, markHelpful);

module.exports = router;

