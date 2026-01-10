const jwt = require('jsonwebtoken');

// Generate JWT token
exports.generateToken = (id, userType = 'customer') => {
  return jwt.sign({ id, userType }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Verify JWT token
exports.verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Generate email verification token
exports.generateEmailVerificationToken = () => {
  return jwt.sign(
    { purpose: 'email_verification' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Generate password reset token
exports.generatePasswordResetToken = () => {
  return jwt.sign(
    { purpose: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

