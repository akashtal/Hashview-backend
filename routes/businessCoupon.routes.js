const express = require('express');
const router = express.Router();
const {
  getBusinessCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  verifyCouponCode
} = require('../controllers/businessCoupon.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Public routes
router.post('/verify', verifyCouponCode);

// Protected routes
router.get('/business/:businessId', protect, authorize('business', 'admin'), getBusinessCoupons);
router.get('/:id', protect, getCoupon);
router.post('/', protect, authorize('business'), createCoupon);
router.put('/:id', protect, authorize('business', 'admin'), updateCoupon);
router.delete('/:id', protect, authorize('business', 'admin'), deleteCoupon);
router.patch('/:id/toggle-status', protect, authorize('business', 'admin'), toggleCouponStatus);

module.exports = router;
