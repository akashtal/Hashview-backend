const express = require('express');
const router = express.Router();
const {
  registerBusiness,
  uploadDocuments,
  getNearbyBusinesses,
  getAllActiveBusinesses,
  searchBusinesses,
  getBusiness,
  getBusinessDashboard,
  generateQRCode,
  updateBusiness,
  updateBusinessImages,
  getMyBusinesses,
  getBusinessByQRCode,
  updateTripAdvisorRating
} = require('../controllers/business.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validation');
const upload = require('../middleware/upload');

// Public routes
router.get('/all', getAllActiveBusinesses);
router.get('/nearby', getNearbyBusinesses);
router.get('/search', searchBusinesses);
router.post('/qr/scan', getBusinessByQRCode);
router.get('/:id', getBusiness);

// Protected routes
router.post('/register', protect, authorize('business'), validate(schemas.createBusiness), registerBusiness);
router.post('/:id/documents', protect, authorize('business'), upload.fields([
  { name: 'ownerIdProof', maxCount: 1 },
  { name: 'foodSafetyCertificate', maxCount: 1 },
  { name: 'businessLicense', maxCount: 1 }
]), uploadDocuments);
router.get('/:id/dashboard', protect, getBusinessDashboard);
router.post('/:id/generate-qr', protect, authorize('business'), generateQRCode);
router.put('/:id', protect, authorize('business'), updateBusiness);
router.put('/:id/images', protect, authorize('business'), updateBusinessImages);
router.put('/:id/tripadvisor-rating', protect, authorize('business', 'admin'), updateTripAdvisorRating);
router.get('/my/businesses', protect, authorize('business'), getMyBusinesses);

module.exports = router;

