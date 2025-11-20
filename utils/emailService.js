const nodemailer = require('nodemailer');
const logger = require('./logger');

// Try to use SendGrid API if available (better for production)
let sendGridClient = null;
try {
  if (process.env.SENDGRID_API_KEY) {
    sendGridClient = require('@sendgrid/mail');
    sendGridClient.setApiKey(process.env.SENDGRID_API_KEY);
    logger.info('✅ SendGrid API initialized');
    console.log('✅ SendGrid API initialized');
  }
} catch (error) {
  // @sendgrid/mail not installed, will use SMTP
  logger.info('ℹ️  SendGrid API package not found, using SMTP');
}

// Email service: SendGrid API (preferred) or SMTP (fallback)
const isProduction = process.env.NODE_ENV === 'production';
const useSendGridAPI = !!process.env.SENDGRID_API_KEY && sendGridClient;
const useSendGridSMTP = isProduction && process.env.SMTP_HOST === 'smtp.sendgrid.net' && !useSendGridAPI;

let transporter = null;

// Initialize email service
if (useSendGridAPI) {
  // SendGrid API (best option - no connection issues)
  logger.info('✅ Email service ready (SendGrid API)');
  console.log('✅ Email service ready (SendGrid API)');
  console.log('📧 FROM_EMAIL:', process.env.FROM_EMAIL || 'NOT SET');
} else if (useSendGridSMTP) {
  // SendGrid SMTP for production (fallback)
  transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // Use TLS
    auth: {
      user: 'apikey', // SendGrid uses literal "apikey" as username
      pass: process.env.SMTP_PASS
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
    pool: true,
    maxConnections: 1,
    maxMessages: 3
  });

  // Verify SendGrid connection (non-blocking)
  transporter.verify((error, success) => {
    if (error) {
      logger.warn('⚠️  SendGrid SMTP connection warning:', error.message);
      logger.warn('💡 Consider using SENDGRID_API_KEY instead of SMTP for better reliability');
      console.log('⚠️  SendGrid SMTP connection warning:', error.message);
      console.log('💡 Tip: Use SENDGRID_API_KEY environment variable for better reliability');
    } else {
      logger.info('✅ Email service ready (SendGrid SMTP)');
      console.log('✅ Email service ready (SendGrid SMTP)');
      console.log('📧 FROM_EMAIL:', process.env.FROM_EMAIL || process.env.SMTP_USER || 'NOT SET');
    }
  });
} else {
  // Gmail SMTP for development
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // Use TLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });

  // Verify SMTP connection (non-blocking)
  transporter.verify((error, success) => {
    if (error) {
      logger.warn('⚠️  SMTP connection warning:', error.message);
      console.log('⚠️  SMTP connection warning:', error.message);
      console.log('💡 Make sure you are using correct SMTP credentials');
    } else {
      logger.info('✅ Email service ready (SMTP)');
      console.log('✅ Email service ready (SMTP)');
      console.log('📧 FROM_EMAIL:', process.env.FROM_EMAIL || process.env.SMTP_USER || 'NOT SET');
    }
  });
}


// Send OTP Email
const sendOTPEmail = async (to, otp, name = 'User') => {
  try {
    // Determine from email: use FROM_EMAIL or SMTP_USER
    const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@gmail.com';
    
    const emailHtml = `
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
      `;

    // Send email via SendGrid API (preferred) or SMTP (fallback)
    if (useSendGridAPI) {
      // Use SendGrid API
      const msg = {
        to: to,
        from: {
          email: fromEmail,
          name: 'HashView'
        },
        subject: 'Welcome to HashView - Verify Your Email',
        html: emailHtml
      };

      const response = await sendGridClient.send(msg);
      logger.info(`✅ Email sent successfully to ${to} via SendGrid API`);
      console.log(`✅ Email sent to: ${to}`);
      console.log(`📧 Status Code: ${response[0].statusCode}`);
      return { messageId: response[0].headers['x-message-id'] || 'sent' };
    } else {
      // Use SMTP (SendGrid or Gmail)
      const mailOptions = {
        from: {
          name: 'HashView',
          address: fromEmail
        },
        to: to,
        subject: 'Welcome to HashView - Verify Your Email',
        html: emailHtml
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`✅ Email sent successfully to ${to}`);
      console.log(`✅ Email sent to: ${to}`);
      console.log(`📧 Message ID: ${info.messageId}`);
      return info;
    }
  } catch (error) {
    logger.error('❌ Error sending email:', error);
    console.error('❌ Error sending email:', error.message);
    
    // If SendGrid API fails, log helpful message
    if (useSendGridAPI) {
      logger.error('💡 Check SENDGRID_API_KEY is valid and has Mail Send permissions');
    }
    
    throw error;
  }
};

// Send Password Reset Email
const sendPasswordResetEmail = async (to, otp, name = 'User') => {
  try {
    // Determine from email: use FROM_EMAIL or SMTP_USER
    const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@gmail.com';
    
    const emailHtml = `
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
      `;

    // Send email via SendGrid API (preferred) or SMTP (fallback)
    if (useSendGridAPI) {
      // Use SendGrid API
      const msg = {
        to: to,
        from: {
          email: fromEmail,
          name: 'HashView'
        },
        subject: 'Reset Your HashView Password',
        html: emailHtml
      };

      const response = await sendGridClient.send(msg);
      logger.info(`✅ Password reset email sent to ${to} via SendGrid API`);
      return { messageId: response[0].headers['x-message-id'] || 'sent' };
    } else {
      // Use SMTP (SendGrid or Gmail)
      const mailOptions = {
        from: {
          name: 'HashView',
          address: fromEmail
        },
        to: to,
        subject: 'Reset Your HashView Password',
        html: emailHtml
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`✅ Password reset email sent to ${to}`);
      return info;
    }
  } catch (error) {
    logger.error('❌ Error sending password reset email:', error);
    throw error;
  }
};

// Export functions
module.exports = {
  sendOTPEmail,
  sendPasswordResetEmail
};

