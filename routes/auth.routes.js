const express = require('express');
const router = express.Router();
const {
  register,
  login,
  sendOTP,
  loginWithPhone,
  forgotPassword,
  resetPassword,
  getMe,
  updatePushToken,
  sendEmailOTP,
  verifyEmailOTP,
  resetPasswordWithOTP
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validation');

// Public routes
router.post('/register', validate(schemas.register), register);
router.post('/login', validate(schemas.login), login);
router.post('/send-otp', sendOTP);
router.post('/login-phone', validate(schemas.loginWithPhone), loginWithPhone);
router.post('/forgot-password', validate(schemas.forgotPassword), forgotPassword);
router.post('/reset-password', validate(schemas.resetPassword), resetPassword);
router.post('/reset-password-otp', validate(schemas.resetPasswordOTP), resetPasswordWithOTP);
router.post('/send-email-otp', sendEmailOTP);
router.post('/verify-email-otp', verifyEmailOTP);

// Protected routes
router.get('/me', protect, getMe);
router.put('/push-token', protect, updatePushToken);

module.exports = router;

