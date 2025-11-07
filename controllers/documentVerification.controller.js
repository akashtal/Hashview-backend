const Business = require('../models/Business.model');
const BusinessOwner = require('../models/BusinessOwner.model');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/emailService');

// @desc    Upload ID proof document
// @route   POST /api/verification/upload-id/:businessId
// @access  Private (Business Owner)
exports.uploadIdProof = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.businessId);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Verify ownership
    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Store document URL from Cloudinary
    business.documents.ownerIdProof.url = req.file.path;
    business.documents.ownerIdProof.publicId = req.file.filename;
    business.documents.ownerIdProof.diditVerificationStatus = 'pending';

    await business.save();

    logger.info(`ID proof uploaded for business ${business._id}`);

    res.status(200).json({
      success: true,
      message: 'ID proof uploaded successfully',
      data: {
        url: req.file.path,
        publicId: req.file.filename
      }
    });

  } catch (error) {
    logger.error('ID proof upload error:', error);
    next(error);
  }
};

// @desc    Upload selfie for face matching
// @route   POST /api/verification/upload-selfie/:businessId
// @access  Private (Business Owner)
exports.uploadSelfie = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.businessId);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No selfie uploaded'
      });
    }

    // Store selfie URL
    business.selfieUrl = req.file.path;
    business.selfiePublicId = req.file.filename;

    await business.save();

    logger.info(`Selfie uploaded for business ${business._id}`);

    res.status(200).json({
      success: true,
      message: 'Selfie uploaded successfully',
      data: {
        url: req.file.path,
        publicId: req.file.filename
      }
    });

  } catch (error) {
    logger.error('Selfie upload error:', error);
    next(error);
  }
};

// @desc    Upload business license
// @route   POST /api/verification/upload-license/:businessId
// @access  Private (Business Owner)
exports.uploadBusinessLicense = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.businessId);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    business.documents.businessLicense.url = req.file.path;
    business.documents.businessLicense.publicId = req.file.filename;
    business.documents.businessLicense.diditVerificationStatus = 'pending';

    await business.save();

    logger.info(`Business license uploaded for business ${business._id}`);

    res.status(200).json({
      success: true,
      message: 'Business license uploaded successfully',
      data: {
        url: req.file.path,
        publicId: req.file.filename
      }
    });

  } catch (error) {
    logger.error('Business license upload error:', error);
    next(error);
  }
};

// @desc    Upload food safety certificate
// @route   POST /api/verification/upload-certificate/:businessId
// @access  Private (Business Owner)
exports.uploadFoodCertificate = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.businessId);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    business.documents.foodSafetyCertificate.url = req.file.path;
    business.documents.foodSafetyCertificate.publicId = req.file.filename;
    business.documents.foodSafetyCertificate.diditVerificationStatus = 'pending';

    await business.save();

    logger.info(`Food safety certificate uploaded for business ${business._id}`);

    res.status(200).json({
      success: true,
      message: 'Food safety certificate uploaded successfully',
      data: {
        url: req.file.path,
        publicId: req.file.filename
      }
    });

  } catch (error) {
    logger.error('Food certificate upload error:', error);
    next(error);
  }
};

// @desc    Submit all documents for verification
// @route   POST /api/verification/submit/:businessId
// @access  Private (Business Owner)
exports.submitForVerification = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.businessId);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if all required documents are uploaded
    const hasIdProof = business.documents.ownerIdProof.url;
    const hasSelfie = business.selfieUrl;
    const hasLicense = business.documents.businessLicense.url;
    const hasCertificate = business.documents.foodSafetyCertificate.url;

    if (!hasIdProof || !hasSelfie || !hasLicense || !hasCertificate) {
      return res.status(400).json({
        success: false,
        message: 'Please upload all required documents',
        missing: {
          idProof: !hasIdProof,
          selfie: !hasSelfie,
          businessLicense: !hasLicense,
          foodCertificate: !hasCertificate
        }
      });
    }

    // Update status to in_review
    business.kycStatus = 'in_review';
    business.documents.ownerIdProof.diditVerificationStatus = 'in_review';
    business.documents.businessLicense.diditVerificationStatus = 'in_review';
    business.documents.foodSafetyCertificate.diditVerificationStatus = 'in_review';
    business.submittedForReviewAt = new Date();

    await business.save();

    // Send notification email
    const owner = await BusinessOwner.findById(business.owner);
    if (owner) {
      await sendEmail({
        to: owner.email,
        subject: 'Documents Submitted for Verification - HashView',
        html: `
          <h2>Hi ${owner.name}!</h2>
          <p>Thank you for submitting your documents for <strong>${business.name}</strong>!</p>
          
          <p><strong>✅ Documents Submitted:</strong></p>
          <ul>
            <li>ID Proof - Submitted</li>
            <li>Selfie - Submitted</li>
            <li>Business License - Submitted</li>
            <li>Food Safety Certificate - Submitted</li>
          </ul>
          
          <p><strong>Next Steps:</strong></p>
          <p>Our verification team will review your documents and approve your business within 24-48 hours.</p>
          <p>You will receive another email once your business is approved and live!</p>
          
          <p>Best regards,<br>HashView Team</p>
        `
      });
    }

    logger.info(`Documents submitted for verification - business ${business._id}`);

    res.status(200).json({
      success: true,
      message: 'Documents submitted successfully! Your business will be reviewed within 24-48 hours.',
      data: {
        business: {
          id: business._id,
          name: business.name,
          kycStatus: business.kycStatus,
          submittedAt: business.submittedForReviewAt
        }
      }
    });

  } catch (error) {
    logger.error('Submit verification error:', error);
    next(error);
  }
};

// @desc    Get verification status
// @route   GET /api/verification/status/:businessId
// @access  Private (Business Owner)
exports.getVerificationStatusInApp = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.businessId)
      .select('name owner kycStatus status documents selfieUrl submittedForReviewAt verifiedAt');

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Be resilient if legacy document fields are missing (hosted Didit flow)
    const docs = business.documents || {};
    const idProof = (docs.ownerIdProof || {});
    const license = (docs.businessLicense || {});
    const certificate = (docs.foodSafetyCertificate || {});

    // Include hosted Didit verification info when available
    const didit = business.diditVerification || {};

    res.status(200).json({
      success: true,
      // Convenience top-level link for mobile
      verificationLink: didit.verificationLink,
      data: {
        businessName: business.name,
        kycStatus: business.kycStatus,
        businessStatus: business.status,
        didit: {
          sessionId: didit.sessionId,
          verificationLink: didit.verificationLink,
          status: didit.status
        },
        documents: {
          idProof: {
            uploaded: !!idProof.url,
            status: idProof.diditVerificationStatus,
            url: idProof.url
          },
          selfie: {
            uploaded: !!business.selfieUrl,
            url: business.selfieUrl
          },
          businessLicense: {
            uploaded: !!license.url,
            status: license.diditVerificationStatus,
            url: license.url
          },
          foodCertificate: {
            uploaded: !!certificate.url,
            status: certificate.diditVerificationStatus,
            url: certificate.url
          }
        },
        submittedAt: business.submittedForReviewAt,
        verifiedAt: business.verifiedAt
      }
    });

  } catch (error) {
    logger.error('Get verification status error:', error);
    next(error);
  }
};

module.exports = exports;

