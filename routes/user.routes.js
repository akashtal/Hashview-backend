const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  getUserReviews,
  getUserCoupons,
  getRewardHistory,
  changePassword,
  uploadProfileImage,
  updateAccountSettings,
  exportUserData,
  deactivateAccount,
  deleteAccount
} = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');
const { uploadProfile } = require('../config/cloudinary');

// All routes require authentication
router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/reviews', getUserReviews);
router.get('/coupons', getUserCoupons);
router.get('/rewards', getRewardHistory);

// New profile management routes
router.post('/change-password', changePassword);
router.post('/upload-profile-image', uploadProfile.single('profileImage'), uploadProfileImage);
router.put('/account-settings', updateAccountSettings);
router.post('/export-data', exportUserData);
router.put('/deactivate', deactivateAccount);
router.delete('/account', deleteAccount);

module.exports = router;
