const { createVerificationSession } = require('../utils/didit');
const logger = require('../utils/logger');

/**
 * Test Didit API connection and authentication
 */
exports.testDiditAuth = async (req, res) => {
  try {
    logger.info('Testing Didit API authentication...');

    // Try to create a test verification session
    const testData = {
      businessId: 'test_123',
      ownerId: 'test_owner_123',
      email: 'test@example.com',
      ownerName: 'Test Owner',
      phone: '+1234567890',
      businessName: 'Test Business',
      category: 'restaurant'
    };

    const result = await createVerificationSession(testData);

    if (result.success) {
      logger.info('✅ Didit API test successful!');
      return res.status(200).json({
        success: true,
        message: 'Didit API authentication successful!',
        data: {
          sessionId: result.sessionId,
          verificationLink: result.verificationLink,
          status: result.status
        }
      });
    } else {
      logger.error('❌ Didit API test failed:', result);
      return res.status(500).json({
        success: false,
        message: 'Didit API test failed',
        error: result.error,
        statusCode: result.statusCode,
        details: result.details
      });
    }

  } catch (error) {
    logger.error('Test Didit Auth Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to test Didit API',
      error: error.message
    });
  }
};

module.exports = exports;

