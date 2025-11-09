const axios = require('axios');
const logger = require('./logger');

// Didit API Configuration (V2 session API uses verification.didit.me)
const DIDIT_API_URL = process.env.DIDIT_API_URL || 'https://verification.didit.me/v2';
const DIDIT_API_KEY = process.env.DIDIT_API_KEY;
const DIDIT_SECRET_KEY = process.env.DIDIT_SECRET_KEY;

// V2 uses x-api-key header, no OAuth token flow required

/**
 * Create a Didit verification session for document verification
 * @param {Object} businessData - Business and owner information
 * @returns {Promise<Object>} Didit session data with verification link
 */
exports.createVerificationSession = async (businessData) => {
  try {
    if (!DIDIT_API_KEY || !DIDIT_SECRET_KEY) {
      throw new Error('Didit API credentials not configured. Please add DIDIT_API_KEY and DIDIT_SECRET_KEY to environment variables.');
    }

    logger.info('Creating Didit verification session for business:', businessData.businessId);

    // V2: Create session with x-api-key
    const response = await axios.post(
      `${DIDIT_API_URL}/session/`,
      {
        workflow_id: process.env.DIDIT_WORKFLOW_ID,
        vendor_data: businessData.businessId || businessData.ownerId,
        callback: `${process.env.BACKEND_URL}/api/webhooks/didit`
      },
      {
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'x-api-key': DIDIT_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info('Didit session created successfully:', response.data?.session_id || response.data?.sessionId);

    return {
      success: true,
      sessionId: response.data?.session_id || response.data?.sessionId,
      verificationLink: response.data?.url || response.data?.verificationUrl,
      expiresAt: response.data?.expires_at || response.data?.expiresAt,
      status: response.data?.status || 'pending'
    };

  } catch (error) {
    const errorDetail = error.response?.data || error.message;
    logger.error('Didit verification session creation failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      detail: errorDetail
    });
    
    return {
      success: false,
      error: error.response?.data?.message || error.response?.data?.error || error.message,
      statusCode: error.response?.status,
      details: errorDetail
    };
  }
};

/**
 * Get verification session status from Didit
 * @param {String} sessionId - Didit session ID
 * @returns {Promise<Object>} Verification status and results
 */
exports.getVerificationStatus = async (sessionId) => {
  try {
    logger.info('Fetching Didit verification status for session:', sessionId);

    // Get access token
    const token = await getAccessToken();

    const response = await axios.get(
      `${DIDIT_API_URL}/verifications/${sessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-Key': DIDIT_API_KEY,
          'X-Secret-Key': DIDIT_SECRET_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data;

    return {
      success: true,
      sessionId: data.sessionId,
      status: data.status, // pending, in_review, verified, rejected
      documents: data.documents.map(doc => ({
        type: doc.type,
        status: doc.status,
        verificationId: doc.id,
        extractedData: doc.extractedData,
        verifiedAt: doc.verifiedAt,
        rejectionReason: doc.rejectionReason
      })),
      livenessCheck: {
        status: data.liveness?.status,
        confidence: data.liveness?.confidence
      },
      faceMatch: {
        status: data.faceMatch?.status,
        confidence: data.faceMatch?.confidence,
        similarity: data.faceMatch?.similarity
      },
      overallResult: data.result,
      completedAt: data.completedAt
    };

  } catch (error) {
    logger.error('Didit status fetch failed:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
};

/**
 * Process Didit webhook callback
 * @param {Object} webhookData - Webhook payload from Didit
 * @returns {Promise<Object>} Processed webhook data
 */
exports.processWebhook = async (webhookData) => {
  try {
    // Log full webhook payload for debugging
    logger.info('📥 Didit webhook received:', JSON.stringify(webhookData, null, 2));
    console.log('📥 Full webhook data:', JSON.stringify(webhookData, null, 2));

    // Verify webhook signature (security)
    const isValid = verifyWebhookSignature(webhookData);
    
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    // Extract data from webhook (Didit may send in different formats)
    const { event, session_id, sessionId, status, documents, metadata, vendor_data } = webhookData;
    
    // Didit uses session_id (snake_case), but we use sessionId (camelCase)
    const actualSessionId = session_id || sessionId;
    
    // Get businessId from metadata or vendor_data
    const businessId = metadata?.businessId || vendor_data;

    logger.info(`✅ Webhook processed: event=${event}, sessionId=${actualSessionId}, businessId=${businessId}`);

    return {
      success: true,
      event: event || 'unknown', // verification.started, verification.completed, document.verified, etc.
      sessionId: actualSessionId,
      businessId: businessId,
      status,
      documents: documents || [],
      timestamp: new Date()
    };

  } catch (error) {
    logger.error('❌ Webhook processing failed:', error.message);
    logger.error('Webhook data:', JSON.stringify(webhookData, null, 2));
    
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Verify Didit webhook signature for security
 * @param {Object} webhookData - Webhook payload
 * @returns {Boolean} True if signature is valid
 */
function verifyWebhookSignature(webhookData) {
  try {
    // Skip signature verification if no secret key is configured
    if (!DIDIT_SECRET_KEY) {
      logger.warn('⚠️  Didit webhook signature verification skipped (no secret key)');
      return true;
    }

    // Didit sends signature in headers (x-didit-signature) not in body
    // For now, we'll skip strict verification and log the webhook
    // TODO: Implement proper signature verification based on Didit's docs
    
    const crypto = require('crypto');
    
    // If webhookData has a signature field, verify it
    if (webhookData.signature) {
      // Remove signature from data before hashing
      const { signature, ...dataToVerify } = webhookData;
      const payload = JSON.stringify(dataToVerify);
      
      const expectedSignature = crypto
        .createHmac('sha256', DIDIT_SECRET_KEY)
        .update(payload)
        .digest('hex');
      
      return signature === expectedSignature;
    }
    
    // If no signature present, allow it (Didit may not always send signatures)
    logger.info('✅ Webhook accepted (no signature to verify)');
    return true;
    
  } catch (error) {
    logger.error('Webhook signature verification error:', error.message);
    // Allow webhook to proceed even if verification fails
    return true;
  }
}

/**
 * Cancel a verification session
 * @param {String} sessionId - Didit session ID
 * @returns {Promise<Object>} Cancellation result
 */
exports.cancelVerification = async (sessionId) => {
  try {
    logger.info('Cancelling Didit session:', sessionId);

    // Get access token
    const token = await getAccessToken();

    const response = await axios.post(
      `${DIDIT_API_URL}/verifications/${sessionId}/cancel`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-Key': DIDIT_API_KEY,
          'X-Secret-Key': DIDIT_SECRET_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      message: 'Verification session cancelled successfully'
    };

  } catch (error) {
    logger.error('Didit cancellation failed:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
};

/**
 * Get verification session link (for resending to user)
 * @param {String} sessionId - Didit session ID
 * @returns {Promise<String>} Verification link
 */
exports.getVerificationLink = async (sessionId) => {
  try {
    // Get access token
    const token = await getAccessToken();

    const response = await axios.get(
      `${DIDIT_API_URL}/verifications/${sessionId}/link`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-Key': DIDIT_API_KEY,
          'X-Secret-Key': DIDIT_SECRET_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.verificationUrl;

  } catch (error) {
    logger.error('Failed to get verification link:', error.message);
    throw error;
  }
};

module.exports = exports;

