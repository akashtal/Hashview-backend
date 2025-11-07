const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('./logger');

// Check if we should use Brevo API instead of SMTP
const useBrevoAPI = process.env.BREVO_API_KEY;

let transporter = null;

if (!useBrevoAPI) {
  // Fallback to SMTP (only works on paid hosting or localhost)
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  // Verify SMTP connection
  transporter.verify((error, success) => {
    if (error) {
      logger.error('❌ SMTP connection error (try using BREVO_API_KEY instead):', error);
      console.log('❌ SMTP connection error. Consider using Brevo API instead of SMTP.');
    } else {
      logger.info('✅ Email service ready (SMTP)');
      console.log('✅ Email service ready (SMTP)');
    }
  });
} else {
  logger.info('✅ Email service using Brevo API');
  console.log('✅ Email service using Brevo API (HTTP)');
}

// Helper function to send email via Brevo API
async function sendViaBrevoAPI(mailOptions) {
  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: mailOptions.from.name,
          email: mailOptions.from.address
        },
        to: [{ email: mailOptions.to }],
        subject: mailOptions.subject,
        htmlContent: mailOptions.html
      },
      {
        headers: {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json'
        }
      }
    );

    logger.info(`✅ Email sent via Brevo API to ${mailOptions.to}`);
    console.log(`✅ Email sent via Brevo API to: ${mailOptions.to}`);
    return { messageId: response.data.messageId };
  } catch (error) {
    logger.error('❌ Brevo API error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to send email via Brevo API');
  }
}

// Send OTP Email
exports.sendOTPEmail = async (to, otp, name = 'User') => {
  try {
    const mailOptions = {
      from: {
        name: 'HashView',
        address: process.env.FROM_EMAIL || process.env.SMTP_USER
      },
      to: to,
      subject: 'HashView - Email Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>HashView OTP</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  
                  <!-- Header with Gradient -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #2D1B69 0%, #4F46E5 100%); padding: 40px 20px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">
                        #HashView
                      </h1>
                      <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">
                        Review. Reward. Repeat.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="color: #2D1B69; margin: 0 0 20px 0; font-size: 24px;">
                        Email Verification
                      </h2>
                      
                      <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Hello ${name},
                      </p>
                      
                      <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        Thank you for signing up with HashView! Please use the verification code below to complete your registration:
                      </p>
                      
                      <!-- OTP Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                        <tr>
                          <td style="background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%); padding: 30px; border-radius: 12px; text-align: center; border: 2px dashed #FF8C00;">
                            <p style="color: #92400e; font-size: 14px; margin: 0 0 10px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                              Your Verification Code
                            </p>
                            <h1 style="color: #FF8C00; font-size: 42px; font-weight: bold; margin: 0; letter-spacing: 12px; font-family: 'Courier New', monospace;">
                              ${otp}
                            </h1>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Important Info -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-left: 4px solid #FF8C00; padding: 15px; border-radius: 8px; margin: 0 0 20px 0;">
                        <tr>
                          <td>
                            <p style="color: #374151; font-size: 14px; margin: 0; line-height: 1.6;">
                              <strong>⏰ Important:</strong> This code will expire in <strong>10 minutes</strong>.
                            </p>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                        If you didn't request this verification code, please ignore this email or contact our support team.
                      </p>
                      
                      <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                        Best regards,<br>
                        <strong style="color: #2D1B69;">The HashView Team</strong>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 10px 0;">
                        © 2025 HashView. All rights reserved.
                      </p>
                      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        This is an automated email, please do not reply.
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    // Use Brevo API if available, otherwise use SMTP
    if (useBrevoAPI) {
      return await sendViaBrevoAPI(mailOptions);
    } else {
      const info = await transporter.sendMail(mailOptions);
      logger.info(`✅ Email sent successfully to ${to}`);
      console.log(`✅ Email sent to: ${to}`);
      console.log(`📧 Message ID: ${info.messageId}`);
      return info;
    }
  } catch (error) {
    logger.error('❌ Error sending email:', error);
    console.error('❌ Error sending email:', error.message);
    throw error;
  }
};

// Send Password Reset Email
exports.sendPasswordResetEmail = async (to, otp, name = 'User') => {
  try {
    const mailOptions = {
      from: {
        name: 'HashView',
        address: process.env.FROM_EMAIL || process.env.SMTP_USER
      },
      to: to,
      subject: 'HashView - Password Reset Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  
                  <tr>
                    <td style="background: linear-gradient(135deg, #2D1B69 0%, #4F46E5 100%); padding: 40px 20px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">#HashView</h1>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="color: #2D1B69; margin: 0 0 20px 0;">Password Reset Request</h2>
                      
                      <p style="color: #6b7280; font-size: 16px; margin: 0 0 20px 0;">Hello ${name},</p>
                      
                      <p style="color: #6b7280; font-size: 16px; margin: 0 0 30px 0;">
                        We received a request to reset your password. Use the code below:
                      </p>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                        <tr>
                          <td style="background: #FFF7ED; padding: 30px; border-radius: 12px; text-align: center; border: 2px dashed #FF8C00;">
                            <h1 style="color: #FF8C00; font-size: 42px; font-weight: bold; margin: 0; letter-spacing: 12px;">${otp}</h1>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #ef4444; font-size: 14px; margin: 0 0 20px 0;">
                        ⚠️ This code expires in 10 minutes.
                      </p>
                      
                      <p style="color: #6b7280; font-size: 14px; margin: 0;">
                        If you didn't request this, please ignore this email.
                      </p>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="background-color: #f9fafb; padding: 20px; text-align: center;">
                      <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2025 HashView. All rights reserved.</p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    // Use Brevo API if available, otherwise use SMTP
    if (useBrevoAPI) {
      return await sendViaBrevoAPI(mailOptions);
    } else {
      const info = await transporter.sendMail(mailOptions);
      logger.info(`✅ Password reset email sent to ${to}`);
      return info;
    }
  } catch (error) {
    logger.error('❌ Error sending password reset email:', error);
    throw error;
  }
};

module.exports = {
  sendOTPEmail: exports.sendOTPEmail,
  sendPasswordResetEmail: exports.sendPasswordResetEmail
};

