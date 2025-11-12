const {
  cloudinary,
  uploadProfile,
  uploadBusinessLogo,
  uploadBusinessCover,
  uploadBusinessDocuments,
  uploadBusinessGallery,
  uploadReviewPhotos,
  uploadReviewVideos
} = require('../config/cloudinary');

// @desc    Upload profile image
// @route   POST /api/upload/profile
// @access  Private
exports.uploadProfileImage = [
  uploadProfile.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload an image'
        });
      }

      // Update user profile image
      req.user.profileImage = req.file.path; // Cloudinary URL
      await req.user.save();

      res.status(200).json({
        success: true,
        message: 'Profile image uploaded successfully',
        imageUrl: req.file.path,
        data: {
          url: req.file.path,
          publicId: req.file.filename,
          format: req.file.format
        }
      });
    } catch (error) {
      // Delete uploaded file if database update fails
      if (req.file?.filename) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      next(error);
    }
  }
];

// @desc    Upload business logo
// @route   POST /api/upload/business/logo?businessId=xxx
// @access  Private (Business Owner)
exports.uploadBusinessLogo = [
  uploadBusinessLogo.single('logo'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload a logo image'
        });
      }

      // Ensure the response includes all necessary data
      const responseData = {
        success: true,
        message: 'Business logo uploaded successfully',
        data: {
          url: req.file.path,
          publicId: req.file.filename,
          format: req.file.format
        },
        // Also include at top level for easier access
        url: req.file.path,
        publicId: req.file.filename
      };

      console.log('✅ Logo uploaded to Cloudinary:', {
        url: req.file.path,
        publicId: req.file.filename,
        folder: req.file.folder || 'hashview/business/logos'
      });

      res.status(200).json(responseData);
    } catch (error) {
      console.error('❌ Error uploading business logo:', error);
      if (req.file?.filename) {
        try {
          await cloudinary.uploader.destroy(req.file.filename);
        } catch (destroyError) {
          console.error('Error deleting failed upload:', destroyError);
        }
      }
      next(error);
    }
  }
];

// @desc    Upload business cover image
// @route   POST /api/upload/business/cover?businessId=xxx
// @access  Private (Business Owner)
exports.uploadBusinessCover = [
  uploadBusinessCover.single('coverImage'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload a cover image'
        });
      }

      const responseData = {
        success: true,
        message: 'Business cover image uploaded successfully',
        data: {
          url: req.file.path,
          publicId: req.file.filename,
          format: req.file.format
        },
        url: req.file.path,
        publicId: req.file.filename
      };

      console.log('✅ Cover image uploaded to Cloudinary:', {
        url: req.file.path,
        publicId: req.file.filename,
        folder: req.file.folder || 'hashview/business/covers'
      });

      res.status(200).json(responseData);
    } catch (error) {
      console.error('❌ Error uploading business cover:', error);
      if (req.file?.filename) {
        try {
          await cloudinary.uploader.destroy(req.file.filename);
        } catch (destroyError) {
          console.error('Error deleting failed upload:', destroyError);
        }
      }
      next(error);
    }
  }
];

// @desc    Upload business documents (KYC)
// @route   POST /api/upload/business/documents
// @access  Private (Business Owner)
exports.uploadBusinessDocuments = [
  uploadBusinessDocuments.array('documents', 5), // Max 5 documents
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please upload at least one document'
        });
      }

      const uploadedDocuments = req.files.map(file => ({
        url: file.path,
        publicId: file.filename,
        format: file.format,
        originalName: file.originalname
      }));

      res.status(200).json({
        success: true,
        message: 'Documents uploaded successfully',
        count: uploadedDocuments.length,
        documents: uploadedDocuments
      });
    } catch (error) {
      // Delete uploaded files if processing fails
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          await cloudinary.uploader.destroy(file.filename);
        }
      }
      next(error);
    }
  }
];

// @desc    Upload business gallery photos
// @route   POST /api/upload/business/gallery?businessId=xxx
// @access  Private (Business Owner)
exports.uploadBusinessGallery = [
  uploadBusinessGallery.array('images', 10), // Max 10 images at once
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please upload at least one image'
        });
      }

      const uploadedImages = req.files.map(file => ({
        url: file.path,
        publicId: file.filename,
        format: file.format
      }));

      console.log(`✅ ${uploadedImages.length} gallery image(s) uploaded to Cloudinary`);

      res.status(200).json({
        success: true,
        message: `${uploadedImages.length} image(s) uploaded successfully`,
        count: uploadedImages.length,
        images: uploadedImages
      });
    } catch (error) {
      console.error('❌ Error uploading business gallery:', error);
      // Delete uploaded files if processing fails
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            await cloudinary.uploader.destroy(file.filename);
          } catch (destroyError) {
            console.error('Error deleting failed upload:', destroyError);
          }
        }
      }
      next(error);
    }
  }
];

// @desc    Delete file from Cloudinary
// @route   DELETE /api/upload/:publicId
// @access  Private
exports.deleteFile = async (req, res, next) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }

    // Delete file from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === 'ok') {
      res.status(200).json({
        success: true,
        message: 'File deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found or already deleted'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get upload statistics (admin)
// @route   GET /api/upload/stats
// @access  Private (Admin)
exports.getUploadStats = async (req, res, next) => {
  try {
    const usage = await cloudinary.api.usage();

    res.status(200).json({
      success: true,
      stats: {
        used: usage.storage.usage,
        limit: usage.storage.limit,
        percentage: ((usage.storage.usage / usage.storage.limit) * 100).toFixed(2),
        bandwidth: usage.bandwidth.usage,
        transformations: usage.transformations.usage
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload review photos
// @route   POST /api/upload/review/photos
// @access  Private
exports.uploadReviewPhotos = [
  uploadReviewPhotos.array('photos', 5), // Max 5 photos per review
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please upload at least one photo'
        });
      }

      const uploadedPhotos = req.files.map(file => ({
        url: file.path,
        publicId: file.filename
      }));

      console.log(`✅ ${uploadedPhotos.length} review photo(s) uploaded to Cloudinary`);

      res.status(200).json({
        success: true,
        message: `${uploadedPhotos.length} photo(s) uploaded successfully`,
        count: uploadedPhotos.length,
        photos: uploadedPhotos
      });
    } catch (error) {
      console.error('❌ Error uploading review photos:', error);
      // Delete uploaded files if processing fails
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            await cloudinary.uploader.destroy(file.filename);
          } catch (destroyError) {
            console.error('Error deleting failed upload:', destroyError);
          }
        }
      }
      next(error);
    }
  }
];

// @desc    Upload review videos
// @route   POST /api/upload/review/videos
// @access  Private
exports.uploadReviewVideos = [
  uploadReviewVideos.array('videos', 2), // Max 2 videos per review
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please upload at least one video'
        });
      }

      const uploadedVideos = req.files.map(file => ({
        url: file.path,
        publicId: file.filename,
        duration: file.duration || null,
        // Cloudinary generates thumbnail automatically for videos
        thumbnail: file.path.replace(/\.(mp4|mov|avi|wmv|flv|webm)$/i, '.jpg')
      }));

      console.log(`✅ ${uploadedVideos.length} review video(s) uploaded to Cloudinary`);

      res.status(200).json({
        success: true,
        message: `${uploadedVideos.length} video(s) uploaded successfully`,
        count: uploadedVideos.length,
        videos: uploadedVideos
      });
    } catch (error) {
      console.error('❌ Error uploading review videos:', error);
      // Delete uploaded files if processing fails
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            await cloudinary.uploader.destroy(file.filename, { resource_type: 'video' });
          } catch (destroyError) {
            console.error('Error deleting failed upload:', destroyError);
          }
        }
      }
      next(error);
    }
  }
];

