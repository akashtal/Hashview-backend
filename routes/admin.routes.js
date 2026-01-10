const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  getAllBusinesses,
  getBusinessById,
  createBusiness,
  updateBusiness,
  updateBusinessRadius,
  updateBusinessKYC,
  updateUserStatus,
  getAllReviews,
  updateReviewStatus,
  sendNotification,
  deleteUser,
  deleteBusiness,
  suspendUser,
  suspendBusiness,
  unsuspendAccount,
  getAllSuspendedAccounts,
  generateBusinessQRCode,
  getAllCoupons,
  toggleCouponStatus,
  deleteCoupon
} = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// All routes are admin-only
router.use(protect, authorize('admin'));

router.get('/dashboard', getDashboardStats);
router.get('/users', getAllUsers);
router.get('/businesses', getAllBusinesses);
router.get('/businesses/:id', getBusinessById);
router.post('/businesses', createBusiness);
router.put('/businesses/:id', updateBusiness);
router.put('/businesses/:id/radius', updateBusinessRadius);
router.put('/businesses/:id/kyc', updateBusinessKYC);
router.post('/businesses/:id/generate-qr', generateBusinessQRCode);
router.put('/users/:id/status', updateUserStatus);
router.get('/reviews', getAllReviews);
router.put('/reviews/:id/status', updateReviewStatus);
router.post('/notifications/send', sendNotification);
router.delete('/users/:id', deleteUser);
router.delete('/businesses/:id', deleteBusiness);

// Suspension routes
router.post('/users/:id/suspend', suspendUser);
router.post('/businesses/:id/suspend', suspendBusiness);
router.post('/suspended/:id/unsuspend', unsuspendAccount);
router.get('/suspended', getAllSuspendedAccounts);

// Coupon Management routes
router.get('/coupons', getAllCoupons);
router.put('/coupons/:id/status', toggleCouponStatus);
router.delete('/coupons/:id', deleteCoupon);

module.exports = router;

