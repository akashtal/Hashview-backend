const express = require('express');
const router = express.Router();
const {
  uploadProfileImage,
  uploadBusinessLogo,
  uploadBusinessCover,
  uploadBusinessDocuments,
  uploadBusinessGallery,
  deleteFile,
  getUploadStats
} = require('../controllers/upload.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Profile image upload (all authenticated users)
router.post('/profile', protect, uploadProfileImage);

// Business-specific uploads (business owners only)
router.post('/business/logo', protect, authorize('business'), uploadBusinessLogo);
router.post('/business/cover', protect, authorize('business'), uploadBusinessCover);
router.post('/business/documents', protect, authorize('business'), uploadBusinessDocuments);
router.post('/business/gallery', protect, authorize('business'), uploadBusinessGallery);

// Delete file (owner or admin)
router.delete('/:publicId', protect, deleteFile);

// Upload statistics (admin only)
router.get('/stats', protect, authorize('admin'), getUploadStats);

module.exports = router;

