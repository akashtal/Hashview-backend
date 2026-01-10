const Business = require('../models/Business.model');
const BusinessOwner = require('../models/BusinessOwner.model');
const diditService = require('../utils/didit');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/emailService');

// @desc    Initiate Didit verification for business
// @route   POST /api/verification/initiate/:businessId
// @access  Private (Business Owner or Admin)
exports.initiateVerification = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.businessId);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Verify ownership (unless admin)
    if (req.user.role !== 'admin' && business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to initiate verification for this business'
      });
    }

    // Get business owner details
    const owner = await BusinessOwner.findById(business.owner);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Business owner not found'
      });
    }

    // Create Didit verification session
    const verificationResult = await diditService.createVerificationSession({
      businessId: business._id,
      businessName: business.name,
      category: business.category,
      ownerId: owner._id,
      ownerName: owner.name,
      email: owner.email,
      phone: owner.phone
    });

    if (!verificationResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create verification session',
        error: verificationResult.error
      });
    }

    // Update business with Didit session info (both legacy and new nested fields)
    business.diditSessionId = verificationResult.sessionId;
    business.diditVerificationLink = verificationResult.verificationLink;
    business.diditVerification = business.diditVerification || {};
    business.diditVerification.sessionId = verificationResult.sessionId;
    business.diditVerification.verificationLink = verificationResult.verificationLink;
    business.diditVerification.status = 'pending';
    business.kycStatus = 'in_review';
    
    await business.save();

    // No email needed - verification happens in-app
    logger.info(`Verification session created for business ${business._id} - In-app verification enabled`);

    res.status(200).json({
      success: true,
      message: 'Verification session created successfully',
      // Duplicate key fields at top-level for mobile compatibility
      sessionId: verificationResult.sessionId,
      verificationLink: verificationResult.verificationLink,
      expiresAt: verificationResult.expiresAt,
      data: {
        sessionId: verificationResult.sessionId,
        verificationLink: verificationResult.verificationLink,
        expiresAt: verificationResult.expiresAt
      }
    });

  } catch (error) {
    logger.error('Verification initiation error:', error);
    next(error);
  }
};

// @desc    Get verification status
// @route   GET /api/verification/status/:businessId
// @access  Private (Business Owner or Admin)
exports.getVerificationStatus = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.businessId);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Verify ownership (unless admin)
    if (req.user.role !== 'admin' && business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view verification status'
      });
    }

    if (!business.diditSessionId) {
      return res.status(400).json({
        success: false,
        message: 'No verification session found for this business'
      });
    }

    // Fetch status from Didit
    const statusResult = await diditService.getVerificationStatus(business.diditSessionId);

    if (!statusResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch verification status',
        error: statusResult.error
      });
    }

    // Update business documents status
    if (statusResult.status === 'verified') {
      statusResult.documents.forEach(doc => {
        if (doc.type === 'id_card' && doc.status === 'verified') {
          business.documents.ownerIdProof.diditVerificationStatus = 'verified';
          business.documents.ownerIdProof.diditVerifiedAt = doc.verifiedAt;
          business.documents.ownerIdProof.verified = true;
        }
        if (doc.type === 'business_license' && doc.status === 'verified') {
          business.documents.businessLicense.diditVerificationStatus = 'verified';
          business.documents.businessLicense.diditVerifiedAt = doc.verifiedAt;
          business.documents.businessLicense.verified = true;
        }
        if (doc.type === 'certificate' && doc.status === 'verified') {
          business.documents.foodSafetyCertificate.diditVerificationStatus = 'verified';
          business.documents.foodSafetyCertificate.diditVerifiedAt = doc.verifiedAt;
          business.documents.foodSafetyCertificate.verified = true;
        }
      });

      // Documents verified by Didit, but still needs admin approval
      business.kycStatus = 'in_review'; // Admin must manually approve
      business.status = 'pending'; // Business not live until admin approves
      await business.save();
      
      logger.info(`✅ Didit verification complete for business ${business._id} - Awaiting admin approval`);
    }

    res.status(200).json({
      success: true,
      data: {
        sessionId: statusResult.sessionId,
        status: statusResult.status,
        documents: statusResult.documents,
        livenessCheck: statusResult.livenessCheck,
        faceMatch: statusResult.faceMatch,
        overallResult: statusResult.overallResult,
        completedAt: statusResult.completedAt,
        kycStatus: business.kycStatus
      }
    });

  } catch (error) {
    logger.error('Get verification status error:', error);
    next(error);
  }
};

// @desc    Handle Didit webhook callbacks
// @route   POST /api/webhooks/didit
// @access  Public (but signature verified)
exports.handleDiditWebhook = async (req, res, next) => {
  try {
    logger.info('📥 Received Didit webhook');
    console.log('📥 Webhook headers:');
    console.log(JSON.stringify(req.headers, null, 2));
    console.log('📥 Webhook body:');
    console.log(JSON.stringify(req.body, null, 2));

    // Process webhook
    const webhookResult = await diditService.processWebhook(req.body);

    if (!webhookResult.success) {
      logger.error('❌ Webhook processing failed:', webhookResult.error);
      return res.status(400).json({
        success: false,
        message: webhookResult.error || 'Invalid webhook'
      });
    }

    const { event, sessionId, businessId, status, documents } = webhookResult;

    // If we can't find businessId from webhook, try to find business by sessionId
    let business;
    
    if (businessId) {
      business = await Business.findById(businessId);
    } else if (sessionId) {
      // Fallback: Find business by Didit session ID
      business = await Business.findOne({ 
        $or: [
          { diditSessionId: sessionId },
          { 'diditVerification.sessionId': sessionId }
        ]
      });
      logger.info(`🔍 Found business by sessionId: ${business?._id}`);
    }

    if (!business) {
      logger.error('❌ Business not found for webhook - businessId:', businessId, 'sessionId:', sessionId);
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Handle different webhook events
    switch (event) {
      case 'verification.started':
        business.kycStatus = 'in_review';
        await business.save();
        logger.info(`Verification started for business ${businessId}`);
        break;

      case 'status.updated':
      case 'verification.completed':
        // Update document statuses
        documents.forEach(doc => {
          if (doc.type === 'id_card') {
            business.documents.ownerIdProof.diditVerificationStatus = doc.status;
            business.documents.ownerIdProof.diditVerificationId = doc.id;
            if (doc.status === 'verified') {
              business.documents.ownerIdProof.verified = true;
              business.documents.ownerIdProof.diditVerifiedAt = new Date();
            }
          }
          if (doc.type === 'business_license') {
            business.documents.businessLicense.diditVerificationStatus = doc.status;
            business.documents.businessLicense.diditVerificationId = doc.id;
            if (doc.status === 'verified') {
              business.documents.businessLicense.verified = true;
              business.documents.businessLicense.diditVerifiedAt = new Date();
            }
          }
          if (doc.type === 'certificate') {
            business.documents.foodSafetyCertificate.diditVerificationStatus = doc.status;
            business.documents.foodSafetyCertificate.diditVerificationId = doc.id;
            if (doc.status === 'verified') {
              business.documents.foodSafetyCertificate.verified = true;
              business.documents.foodSafetyCertificate.diditVerifiedAt = new Date();
            }
          }
        });

        // Update overall KYC status
        if (status === 'Approved' || status === 'verified') {
          // Didit verified documents - now awaiting admin approval
          business.kycStatus = 'in_review';
          business.status = 'pending';
          logger.info(`✅ KYC status updated to 'in_review' for business ${businessId}`);
        } else if (status === 'Declined' || status === 'rejected') {
          business.kycStatus = 'rejected';
          business.status = 'rejected';
          logger.warn(`⚠️  KYC status updated to 'rejected' for business ${businessId}`);
        }

        await business.save();

        // Send notification to business owner
        const owner = await BusinessOwner.findById(business.owner);
        if (owner && status === 'verified') {
          await sendEmail({
            to: owner.email,
            subject: 'Document Verification Completed - HashView',
            html: `
              <h2>Hi ${owner.name}!</h2>
              <p>Great news! Your documents for <strong>${business.name}</strong> have been successfully verified!</p>
              <p><strong>✅ Verified Documents:</strong></p>
              <ul>
                <li>ID Proof - Verified</li>
                <li>Business License - Verified</li>
                <li>Food Safety Certificate - Verified</li>
                <li>Face Match - Verified</li>
              </ul>
              <p><strong>Next Step:</strong> Our admin team will review your business details and approve your account within 24-48 hours.</p>
              <p>You will receive another email once your business is approved and live!</p>
              <p>Best regards,<br>HashView Team</p>
            `
          });
        }

        logger.info(`✅ Didit verification completed for business ${businessId}: ${status} - Awaiting admin approval`);
        break;

      default:
        logger.info(`Unhandled webhook event: ${event}`);
    }

    // Acknowledge webhook
    res.status(200).json({ success: true, received: true });

  } catch (error) {
    logger.error('Webhook handling error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Resend verification link
// @route   POST /api/verification/resend/:businessId
// @access  Private (Business Owner or Admin)
exports.resendVerificationLink = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.businessId);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Verify ownership
    if (req.user.role !== 'admin' && business.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (!business.diditSessionId) {
      return res.status(400).json({
        success: false,
        message: 'No verification session found. Please initiate verification first.'
      });
    }

    const owner = await BusinessOwner.findById(business.owner);

    // Send email with verification link
    await sendEmail({
      to: owner.email,
      subject: 'Complete Your Business Verification - HashView',
      html: `
        <h2>Hi ${owner.name},</h2>
        <p>Here's your verification link for <strong>${business.name}</strong>:</p>
        <p><a href="${business.diditVerificationLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Continue Verification</a></p>
        <p>Best regards,<br>HashView Team</p>
      `
    });

    res.status(200).json({
      success: true,
      message: 'Verification link sent successfully'
    });

  } catch (error) {
    logger.error('Resend verification link error:', error);
    next(error);
  }
};

module.exports = exports;

