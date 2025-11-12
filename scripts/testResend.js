require('dotenv').config();
const { sendOTPEmail, sendPasswordResetEmail } = require('../utils/emailService');

async function testResend() {
  console.log('\n🧪 ===== RESEND EMAIL SERVICE TEST =====\n');
  
  // Check environment variables
  console.log('📋 Environment Check:');
  console.log('   RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ SET' : '❌ NOT SET');
  console.log('   FROM_EMAIL:', process.env.FROM_EMAIL || '❌ NOT SET');
  console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('');
  
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ ERROR: RESEND_API_KEY is not set!');
    console.log('   Please add RESEND_API_KEY to your .env file\n');
    process.exit(1);
  }
  
  if (!process.env.FROM_EMAIL) {
    console.error('❌ WARNING: FROM_EMAIL is not set!');
    console.log('   Using default sender address\n');
  }
  
  // Get test email from command line or use default
  const testEmail = process.argv[2] || 'test@example.com';
  
  console.log(`📧 Sending test emails to: ${testEmail}\n`);
  console.log('⏳ Please wait...\n');
  
  try {
    // Test 1: OTP Email
    console.log('📧 Test 1: Sending OTP verification email...');
    const otpResult = await sendOTPEmail(testEmail, '123456', 'Test User');
    console.log(`✅ OTP email sent successfully!`);
    console.log(`   Message ID: ${otpResult.messageId}\n`);
    
    // Wait 2 seconds between emails
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Password Reset Email
    console.log('📧 Test 2: Sending password reset email...');
    const resetResult = await sendPasswordResetEmail(testEmail, '654321', 'Test User');
    console.log(`✅ Password reset email sent successfully!`);
    console.log(`   Message ID: ${resetResult.messageId}\n`);
    
    console.log('🎉 ===== ALL TESTS PASSED! =====\n');
    console.log('💡 Check your inbox (and spam folder) at:', testEmail);
    console.log('💡 You should receive 2 emails:');
    console.log('   1. Email Verification Code (OTP: 123456)');
    console.log('   2. Password Reset Code (OTP: 654321)\n');
    console.log('📊 Monitor your emails at: https://resend.com/emails\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ===== TEST FAILED! =====\n');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check if RESEND_API_KEY is correct');
    console.error('2. Verify your domain is set up in Resend');
    console.error('3. Make sure FROM_EMAIL is valid');
    console.error('4. Check Resend dashboard for errors\n');
    process.exit(1);
  }
}

// Run test
console.log('\n🚀 Starting Resend Email Test...\n');
console.log('Usage: node scripts/testResend.js [test-email@example.com]\n');

testResend();

