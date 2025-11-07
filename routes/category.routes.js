const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoryCount
} = require('../controllers/category.controller');
const { protect, authorize, optionalAuth } = require('../middleware/auth.middleware');

// Public routes (with optional auth for admin to see all categories)
router.get('/', optionalAuth, getCategories);
router.get('/:id', getCategory);

// Admin routes
router.post('/', protect, authorize('admin'), createCategory);
router.put('/:id', protect, authorize('admin'), updateCategory);
router.delete('/:id', protect, authorize('admin'), deleteCategory);
router.put('/:id/update-count', protect, authorize('admin'), updateCategoryCount);

module.exports = router;

