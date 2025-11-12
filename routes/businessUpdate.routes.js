const express = require('express');
const router = express.Router();
const {
  getBusinessUpdates,
  createBusinessUpdate,
  updateBusinessUpdate,
  deleteBusinessUpdate
} = require('../controllers/businessUpdate.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Public routes
router.get('/business/:businessId/updates', getBusinessUpdates);

// Protected routes (Business owner only)
router.post('/business/:businessId/updates', protect, authorize('business'), createBusinessUpdate);
router.put('/updates/:updateId', protect, authorize('business'), updateBusinessUpdate);
router.delete('/updates/:updateId', protect, authorize('business'), deleteBusinessUpdate);

module.exports = router;

