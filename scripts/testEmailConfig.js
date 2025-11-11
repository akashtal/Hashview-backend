require('dotenv').config();

console.log('\n📧 ===== EMAIL CONFIGURATION CHECK =====\n');

// Check environment variables
console.log('🔍 Checking Environment Variables:');
console.log('   SMTP_HOST:', process.env.SMTP_HOST || '❌ NOT SET');
console.log('   SMTP_PORT:', process.env.SMTP_PORT || '❌ NOT SET');
console.log('   SMTP_USER:', process.env.SMTP_USER || '❌ NOT SET');
console.log('   SMTP_PASS:', process.env.SMTP_PASS ? '✅ SET (hidden)' : '❌ NOT SET');
console.log('   BREVO_API_KEY:', process.env.BREVO_API_KEY ? '✅ SET (hidden)' : '❌ NOT SET');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');

console.log('\n🔧 Email Service Configuration:');

const emailConfigured = process.env.BREVO_API_KEY || 
                       (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

if (emailConfigured) {
  console.log('   ✅ Email service IS configured');
  
  if (process.env.NODE_ENV === 'production' && process.env.BREVO_API_KEY) {
    console.log('   📧 Will use: Brevo API (Production mode)');
  } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('   📧 Will use: Gmail SMTP (Development mode)');
    console.log(`   📮 SMTP Server: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
    console.log(`   👤 SMTP User: ${process.env.SMTP_USER}`);
  }
} else {
  console.log('   ❌ Email service is NOT configured');
  console.log('\n💡 To fix this, add to your .env file:');
  console.log('   SMTP_HOST=smtp.gmail.com');
  console.log('   SMTP_PORT=587');
  console.log('   SMTP_USER=your-email@gmail.com');
  console.log('   SMTP_PASS=your-gmail-app-password');
}

console.log('\n=======================================\n');

// Test SMTP connection if configured
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  console.log('🧪 Testing SMTP connection...\n');
  
  const nodemailer = require('nodemailer');
  
  const transporter = nodemailer.createTransport({
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
  
  transporter.verify((error, success) => {
    if (error) {
      console.log('❌ SMTP Connection FAILED:');
      console.log('   Error:', error.message);
      console.log('\n💡 Common fixes:');
      console.log('   1. Make sure you are using Gmail App Password (not regular password)');
      console.log('   2. Enable 2-Step Verification on your Google account');
      console.log('   3. Generate App Password: https://myaccount.google.com/apppasswords');
      console.log('   4. Check your firewall/antivirus settings');
    } else {
      console.log('✅ SMTP Connection SUCCESS!');
      console.log('   Gmail SMTP is working correctly');
      console.log('   Emails will be sent successfully');
    }
    console.log('\n=======================================\n');
    process.exit(0);
  });
} else {
  process.exit(0);
}

