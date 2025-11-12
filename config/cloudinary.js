const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Profile Image Storage
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'hashview/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 500, height: 500, crop: 'fill', gravity: 'face' },
      { quality: 'auto' }
    ]
  }
});

// Helper function to sanitize business name for folder names
const sanitizeFolderName = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 50); // Limit length
};

// Business Logo Storage - Dynamic folder based on business
const businessLogoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Get business ID from query params or body
    const businessId = req.query.businessId || req.body.businessId;
    let folderPath = 'hashview/business/logos';
    
    if (businessId) {
      try {
        const Business = require('../models/Business.model');
        const business = await Business.findById(businessId).select('name');
        if (business && business.name) {
          const folderName = sanitizeFolderName(business.name);
          folderPath = `hashview/business/${folderName}/logo`;
        }
      } catch (err) {
        console.error('Error getting business name for folder:', err);
      }
    }
    
    return {
      folder: folderPath,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
      transformation: [
        { width: 400, height: 400, crop: 'fill' },
        { quality: 'auto', fetch_format: 'auto' }
      ],
      overwrite: false,
      resource_type: 'image'
    };
  }
});

// Business Cover Image Storage
const businessCoverStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const businessId = req.query.businessId || req.body.businessId;
    let folderPath = 'hashview/business/covers';
    
    if (businessId) {
      try {
        const Business = require('../models/Business.model');
        const business = await Business.findById(businessId).select('name');
        if (business && business.name) {
          const folderName = sanitizeFolderName(business.name);
          folderPath = `hashview/business/${folderName}/cover`;
        }
      } catch (err) {
        console.error('Error getting business name for folder:', err);
      }
    }
    
    return {
      folder: folderPath,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [
        { width: 1200, height: 600, crop: 'fill' },
        { quality: 'auto', fetch_format: 'auto' }
      ],
      overwrite: false,
      resource_type: 'image'
    };
  }
});

// Business Documents Storage (KYC, licenses, etc.)
const businessDocumentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const businessId = req.query.businessId || req.body.businessId;
    let folderPath = 'hashview/business/documents';
    
    if (businessId) {
      try {
        const Business = require('../models/Business.model');
        const business = await Business.findById(businessId).select('name');
        if (business && business.name) {
          const folderName = sanitizeFolderName(business.name);
          folderPath = `hashview/business/${folderName}/documents`;
        }
      } catch (err) {
        console.error('Error getting business name for folder:', err);
      }
    }
    
    return {
      folder: folderPath,
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
      resource_type: 'auto',
      overwrite: false
    };
  }
});

// Business Gallery Storage
const businessGalleryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const businessId = req.query.businessId || req.body.businessId;
    let folderPath = 'hashview/business/gallery';
    
    if (businessId) {
      try {
        const Business = require('../models/Business.model');
        const business = await Business.findById(businessId).select('name');
        if (business && business.name) {
          const folderName = sanitizeFolderName(business.name);
          folderPath = `hashview/business/${folderName}/gallery`;
        }
      } catch (err) {
        console.error('Error getting business name for folder:', err);
      }
    }
    
    return {
      folder: folderPath,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [
        { width: 1024, height: 768, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' }
      ],
      overwrite: false,
      resource_type: 'image'
    };
  }
});

// Create multer instances
const uploadProfile = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

const uploadBusinessLogo = multer({
  storage: businessLogoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

const uploadBusinessCover = multer({
  storage: businessCoverStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

const uploadBusinessDocuments = multer({
  storage: businessDocumentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB per document
  }
});

const uploadBusinessGallery = multer({
  storage: businessGalleryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB per image
  }
});

// Review Media Storage (Photos)
const reviewPhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'hashview/reviews/photos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 1024, height: 1024, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
    overwrite: false,
    resource_type: 'image'
  }
});

// Review Media Storage (Videos)
const reviewVideoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'hashview/reviews/videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm'],
    overwrite: false
  }
});

const uploadReviewPhotos = multer({
  storage: reviewPhotoStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB per photo
  }
});

const uploadReviewVideos = multer({
  storage: reviewVideoStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB per video
  }
});

module.exports = {
  cloudinary,
  uploadProfile,
  uploadBusinessLogo,
  uploadBusinessCover,
  uploadBusinessDocuments,
  uploadBusinessGallery,
  uploadReviewPhotos,
  uploadReviewVideos
};

