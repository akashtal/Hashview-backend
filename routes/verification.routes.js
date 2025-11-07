const express = require('express');
const router = express.Router();
const {
  initiateVerification,
  getVerificationStatus,
  handleDiditWebhook,
  resendVerificationLink
} = require('../controllers/verification.controller');
const {
  uploadIdProof,
  uploadSelfie,
  uploadBusinessLicense,
  uploadFoodCertificate,
  submitForVerification,
  getVerificationStatusInApp
} = require('../controllers/documentVerification.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { uploadBusinessDocuments, uploadProfile } = require('../config/cloudinary');

// ===== IN-APP VERIFICATION (No email needed) =====

// Upload ID proof
router.post('/upload-id/:businessId', protect, authorize('business'), uploadBusinessDocuments.single('idProof'), uploadIdProof);

// Upload selfie for face matching
router.post('/upload-selfie/:businessId', protect, authorize('business'), uploadProfile.single('selfie'), uploadSelfie);

// Upload business license
router.post('/upload-license/:businessId', protect, authorize('business'), uploadBusinessDocuments.single('license'), uploadBusinessLicense);

// Upload food safety certificate
router.post('/upload-certificate/:businessId', protect, authorize('business'), uploadBusinessDocuments.single('certificate'), uploadFoodCertificate);

// Submit all documents for verification
router.post('/submit/:businessId', protect, authorize('business'), submitForVerification);

// Get in-app verification status
router.get('/status-app/:businessId', protect, authorize('business', 'admin'), getVerificationStatusInApp);

// ===== DIDIT EXTERNAL VERIFICATION (Legacy/Optional) =====

// Initiate Didit verification (Business Owner or Admin)
router.post('/initiate/:businessId', protect, authorize('business', 'admin'), initiateVerification);

// Get verification status (Business Owner or Admin)
router.get('/status/:businessId', protect, authorize('business', 'admin'), getVerificationStatus);

// Resend verification link (Business Owner or Admin)
router.post('/resend/:businessId', protect, authorize('business', 'admin'), resendVerificationLink);

module.exports = router;

