const User = require('../models/User.model');
const BusinessOwner = require('../models/BusinessOwner.model');
const SuspendedAccount = require('../models/SuspendedAccount.model');
const { generateToken } = require('../utils/jwt');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { sendOTPEmail, sendPasswordResetEmail } = require('../utils/emailService');

// In-memory OTP storage (in production, use Redis)
const otpStore = new Map();
const emailOtpStore = new Map();

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      password, 
      role,
      address: addressInput,
      buildingNumber,
      street,
      city,
      county,
      state,
      postcode,
      pincode,
      country,
      landmark
    } = req.body;

    console.log('\n📝 Registration attempt:', { 
      name, 
      email, 
      phone, 
      phoneLength: phone?.length,
      role 
    });

    // Prevent admin registration through API
    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin accounts cannot be created through registration. Please contact system administrator.'
      });
    }

    // Validate role
    const allowedRoles = ['customer', 'business'];
    const userRole = role && allowedRoles.includes(role) ? role : 'customer';
    
    console.log(`\n📋 Registration Role Check:`);
    console.log(`   - Requested role: ${role}`);
    console.log(`   - Final userRole: ${userRole}`);

    // Check if email is suspended
    const suspendedAccount = await SuspendedAccount.findOne({ 
      email: email.toLowerCase(), 
      status: 'suspended' 
    });

    if (suspendedAccount) {
      console.log(`❌ Registration blocked: Email is suspended`);
      return res.status(403).json({
        success: false,
        message: 'This account has been suspended. Please contact support for assistance.',
        reason: suspendedAccount.reason
      });
    }

    // Check if email exists in SAME ROLE collection only (allow same email for different roles)
    console.log(`\n📧 Email Validation for role: ${userRole}`);
    const normalizedEmail = email.toLowerCase();
    
    if (userRole === 'business') {
      // Check if email already exists as business owner (SAME ROLE - BLOCK)
      const existingBusinessOwnerByEmail = await BusinessOwner.findOne({ email: normalizedEmail });
      if (existingBusinessOwnerByEmail) {
        console.log(`❌ Email ${normalizedEmail} already registered as business owner`);
        return res.status(400).json({
          success: false,
          message: 'This email is already registered as a business owner. Please login or use a different email.',
          field: 'email'
        });
      }
      // Allow if email exists as customer (DIFFERENT ROLE - ALLOW)
      const existingUserByEmail = await User.findOne({ email: normalizedEmail });
      if (existingUserByEmail) {
        console.log(`✅ Email ${normalizedEmail} exists as customer, but allowing business account creation (different role)`);
      } else {
        console.log(`✅ Email ${normalizedEmail} is available for business registration`);
      }
    } else {
      // Check if email already exists as customer (SAME ROLE - BLOCK)
      const existingUserByEmail = await User.findOne({ email: normalizedEmail });
      if (existingUserByEmail) {
        console.log(`❌ Email ${normalizedEmail} already registered as customer`);
        return res.status(400).json({
          success: false,
          message: 'This email is already registered as a customer. Please login or use a different email.',
          field: 'email'
        });
      }
      // Allow if email exists as business owner (DIFFERENT ROLE - ALLOW)
      const existingBusinessOwnerByEmail = await BusinessOwner.findOne({ email: normalizedEmail });
      if (existingBusinessOwnerByEmail) {
        console.log(`✅ Email ${normalizedEmail} exists as business owner, but allowing customer account creation (different role)`);
      } else {
        console.log(`✅ Email ${normalizedEmail} is available for customer registration`);
      }
    }

    // Check if phone exists in SAME ROLE collection only (allow same phone for different roles)
    console.log(`\n📱 Phone Validation for role: ${userRole}`);
    
    if (userRole === 'business') {
      // Check if phone already exists as business owner (SAME ROLE - BLOCK duplicate)
      const existingBusinessOwnerByPhone = await BusinessOwner.findOne({ phone });
      if (existingBusinessOwnerByPhone) {
        console.log(`❌ Phone ${phone} already registered as business owner (duplicate business account blocked)`);
        // Check if they also have a customer account with same phone
        const existingCustomerByPhone = await User.findOne({ phone });
        if (existingCustomerByPhone) {
          return res.status(400).json({
            success: false,
            message: 'You already have a business account with this phone number. You cannot create duplicate business accounts. Please login to your existing business account.',
            field: 'phone',
            hasBothAccounts: true
          });
        } else {
          return res.status(400).json({
            success: false,
            message: 'This phone number is already registered as a business owner. Please login to your existing account or use a different phone number to create a new business account.',
            field: 'phone'
          });
        }
      }
      // Allow if phone exists as customer (DIFFERENT ROLE - ALLOW)
      const existingUserByPhone = await User.findOne({ phone });
      if (existingUserByPhone) {
        console.log(`✅ Phone ${phone} exists as customer, allowing business account creation (different role - same user)`);
      } else {
        console.log(`✅ Phone ${phone} is available for business registration`);
      }
    } else {
      // Check if phone already exists as customer (SAME ROLE - BLOCK duplicate)
      const existingUserByPhone = await User.findOne({ phone });
      if (existingUserByPhone) {
        console.log(`❌ Phone ${phone} already registered as customer (duplicate customer account blocked)`);
        // Check if they also have a business account with same phone
        const existingBusinessByPhone = await BusinessOwner.findOne({ phone });
        if (existingBusinessByPhone) {
          return res.status(400).json({
            success: false,
            message: 'You already have a customer account with this phone number. You cannot create duplicate customer accounts. Please login to your existing customer account.',
            field: 'phone',
            hasBothAccounts: true
          });
        } else {
          return res.status(400).json({
            success: false,
            message: 'This phone number is already registered as a customer. Please login to your existing account or use a different phone number to create a new customer account.',
            field: 'phone'
          });
        }
      }
      // Allow if phone exists as business owner (DIFFERENT ROLE - ALLOW)
      const existingBusinessOwnerByPhone = await BusinessOwner.findOne({ phone });
      if (existingBusinessOwnerByPhone) {
        console.log(`✅ Phone ${phone} exists as business owner, allowing customer account creation (different role - same user)`);
      } else {
        console.log(`✅ Phone ${phone} is available for customer registration`);
      }
    }

    console.log(`✅ Email and phone are available for ${userRole} registration`);

    const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
    const resolvedCountry = normalizeString(country) || (typeof addressInput === 'object' ? normalizeString(addressInput.country) : '') || 'United Kingdom';
    const manualFullAddressParts = [
      normalizeString(buildingNumber),
      normalizeString(street),
      normalizeString(city),
      normalizeString(county),
      normalizeString(state),
      normalizeString(postcode),
      normalizeString(pincode),
      resolvedCountry
    ].filter(part => part.length);
    if (normalizeString(landmark)) {
      manualFullAddressParts.push(`Near: ${normalizeString(landmark)}`);
    }
    const manualFullAddress = manualFullAddressParts.join(', ');

    const buildAddressPayload = () => {
      const hasManualFields = normalizeString(buildingNumber) || normalizeString(street) || normalizeString(city) || normalizeString(county) || normalizeString(state) || normalizeString(postcode) || normalizeString(pincode) || normalizeString(landmark);
      if (addressInput && typeof addressInput === 'object' && Object.keys(addressInput).length > 0) {
        const fullAddressFromInput = normalizeString(addressInput.fullAddress) || manualFullAddress || normalizeString(addressInput.address);
        return {
          buildingNumber: normalizeString(addressInput.buildingNumber) || normalizeString(buildingNumber),
          street: normalizeString(addressInput.street) || normalizeString(street),
          city: normalizeString(addressInput.city) || normalizeString(city),
          county: normalizeString(addressInput.county) || normalizeString(county),
          state: normalizeString(addressInput.state) || normalizeString(state),
          postcode: normalizeString(addressInput.postcode) || normalizeString(postcode),
          country: normalizeString(addressInput.country) || resolvedCountry,
          landmark: normalizeString(addressInput.landmark) || normalizeString(landmark),
          fullAddress: fullAddressFromInput || null
        };
      }

      if (typeof addressInput === 'string' && normalizeString(addressInput)) {
        return {
          buildingNumber: normalizeString(buildingNumber),
          street: normalizeString(street),
          city: normalizeString(city),
          county: normalizeString(county),
          state: normalizeString(state),
          postcode: normalizeString(postcode),
          country: resolvedCountry,
          landmark: normalizeString(landmark),
          fullAddress: normalizeString(addressInput)
        };
      }

      if (hasManualFields || manualFullAddress) {
        return {
          buildingNumber: normalizeString(buildingNumber),
          street: normalizeString(street),
          city: normalizeString(city),
          county: normalizeString(county),
          state: normalizeString(state),
          postcode: normalizeString(postcode),
          country: resolvedCountry,
          landmark: normalizeString(landmark),
          fullAddress: manualFullAddress || null
        };
      }

      return null;
    };

    const addressPayload = buildAddressPayload();

    let user;
    let token;

    // Create business owner in separate collection
    if (userRole === 'business') {
      console.log('Creating business owner with data:', { name, email, phone, role: userRole });
      const businessOwnerData = {
        name,
        email: email.toLowerCase(),
        phone,
        passwordHash: password,
        role: 'business'
      };

      if (addressPayload) {
        businessOwnerData.address = {
          ...addressPayload,
          country: addressPayload.country || 'United Kingdom'
        };
      }

      user = await BusinessOwner.create(businessOwnerData);
      console.log('✅ Business owner created successfully:', user._id);
      
      // Generate token with userType to identify collection
      token = generateToken(user._id, 'business');
    } else {
      // Create customer in User collection
      console.log('Creating customer with data:', { name, email, phone, role: userRole });
      const userCreatePayload = {
        name,
        email: email.toLowerCase(),
        phone,
        passwordHash: password,
        role: userRole
      };

      if (addressPayload) {
        userCreatePayload.address = {
          ...addressPayload,
          country: addressPayload.country || 'United Kingdom'
        };
        userCreatePayload.location = {
          type: 'Point',
          coordinates: [0, 0],
          address: addressPayload.fullAddress || manualFullAddress || ''
        };
      }

      user = await User.create(userCreatePayload);
      console.log('✅ Customer created successfully:', user._id);
      
      // Generate token with userType
      token = generateToken(user._id, 'customer');
    }

    // Welcome message (email sending can be added later if needed)
    logger.info(`New user registered: ${email} as ${userRole}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error.message);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      console.error('Validation errors:', errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    console.log('\n🔐 Login attempt:', { email, requestedRole: role });

    let user = null;
    let userType = null;

    // If role is specified, search in the appropriate collection first
    if (role === 'business') {
      // Try BusinessOwner collection first (with businesses populated)
      user = await BusinessOwner.findOne({ email }).select('+passwordHash').populate('businesses');
      if (user) {
        userType = 'business';
        console.log(`✅ Found business account for ${email}`);
      } else {
        // Fallback to User collection (in case admin/customer trying business login)
        user = await User.findOne({ email }).select('+passwordHash');
        if (user) {
          userType = user.role === 'admin' ? 'admin' : 'customer';
          console.log(`⚠️  Found ${userType} account for ${email}, but business login was requested`);
        }
      }
    } else {
      // Try User collection first (customer or admin)
      user = await User.findOne({ email }).select('+passwordHash');
      
      if (user) {
        userType = user.role === 'admin' ? 'admin' : 'customer';
        console.log(`✅ Found ${userType} account for ${email}`);
      } else {
        // Fallback to BusinessOwner collection (with businesses populated)
        user = await BusinessOwner.findOne({ email }).select('+passwordHash').populate('businesses');
        if (user) {
          userType = 'business';
          console.log(`⚠️  Found business account for ${email}, but customer login was requested`);
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if email is suspended
    const suspendedAccount = await SuspendedAccount.findOne({ 
      email: email.toLowerCase(), 
      status: 'suspended' 
    });

    if (suspendedAccount) {
      console.log(`❌ Login blocked: Account is suspended`);
      return res.status(403).json({
        success: false,
        message: 'This account has been suspended. Please contact support for assistance.',
        reason: suspendedAccount.reason
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact support.'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token with userType
    const token = generateToken(user._id, userType);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        ...(user.role === 'business' && user.businesses && { businesses: user.businesses })
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send OTP for phone login
// @route   POST /api/auth/send-otp
// @access  Public
exports.sendOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with 5 minute expiry
    otpStore.set(phone, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    // In production, send OTP via SMS service (Twilio, etc.)
    logger.info(`OTP for ${phone}: ${otp}`);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      // Only for development - remove in production
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login with phone and OTP
// @route   POST /api/auth/login-phone
// @access  Public
exports.loginWithPhone = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    // Verify OTP
    const storedOTP = otpStore.get(phone);
    
    if (!storedOTP) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found or expired'
      });
    }

    if (Date.now() > storedOTP.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({
        success: false,
        message: 'OTP expired'
      });
    }

    if (storedOTP.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Find user in both collections
    let user = await User.findOne({ phone });
    let userType = 'customer';
    
    if (!user) {
      user = await BusinessOwner.findOne({ phone });
      if (user) {
        userType = 'business';
      }
    }
    
    if (!user) {
      // Create new customer with phone
      user = await User.create({
        name: 'User',
        email: `${phone}@hashview.temp`,
        phone,
        passwordHash: crypto.randomBytes(16).toString('hex'),
        phoneVerified: true,
        role: 'customer'
      });
      userType = 'customer';
    } else {
      user.phoneVerified = true;
      user.lastLogin = new Date();
      await user.save();
    }

    // Delete OTP after successful login
    otpStore.delete(phone);

    // Generate token with userType
    const token = generateToken(user._id, userType);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour

    await user.save();

    // Note: This function is not used in current flow
    // Password reset uses OTP via sendEmailOTP function instead
    logger.info(`Password reset requested for ${email}`);

    res.status(200).json({
      success: true,
      message: 'Password reset email sent',
      // Only for development
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password
    user.passwordHash = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate new token
    const authToken = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      token: authToken
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    // req.user is already populated by the auth middleware
    // It contains the user from the correct collection (User or BusinessOwner)
    const user = req.user;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return user data based on their role
    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        status: user.status,
        createdAt: user.createdAt,
        // Include business-specific fields if it's a business owner
        ...(user.role === 'business' && { businesses: user.businesses }),
        // Include customer-specific fields if it's a customer
        ...(user.role === 'customer' && { location: user.location })
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update push token
// @route   PUT /api/auth/push-token
// @access  Private
exports.updatePushToken = async (req, res, next) => {
  try {
    const { pushToken } = req.body;

    // req.user is already populated by auth middleware with correct user
    req.user.pushToken = pushToken;
    await req.user.save();

    res.status(200).json({
      success: true,
      message: 'Push token updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send email OTP
// @route   POST /api/auth/send-email-otp
// @access  Public
exports.sendEmailOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with 10 minute expiry
    emailOtpStore.set(normalizedEmail, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    // Send OTP via Email (Brevo API or SMTP)
    const emailConfigured = process.env.BREVO_API_KEY || 
                           (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    
    if (emailConfigured) {
      try {
        await sendOTPEmail(normalizedEmail, otp);
        console.log(`\n✅ OTP email sent to: ${normalizedEmail}`);
      } catch (error) {
        logger.error('Error sending email OTP:', error);
        console.error('❌ Failed to send email:', error.message);
      }
    } else {
      console.log('\n⚠️  Email service not configured - Email not sent');
      console.log('Add BREVO_API_KEY or SMTP credentials to environment variables');
    }

    // Always log OTP to console for backup/testing
    console.log(`\n🔐 EMAIL OTP for ${normalizedEmail}: ${otp}`);
    console.log(`⏰ Expires in 10 minutes`);
    console.log(`📝 Stored in emailOtpStore with key: ${normalizedEmail}\n`);
    logger.info(`Email OTP process completed for ${normalizedEmail}`);

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email OTP
// @route   POST /api/auth/verify-email-otp
// @access  Public
exports.verifyEmailOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Normalize email to lowercase and trim OTP
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOTP = otp.trim();

    // Debug logging
    console.log(`\n🔍 Verifying OTP for email: ${normalizedEmail}`);
    console.log(`🔍 Received OTP: ${normalizedOTP}`);
    console.log(`🔍 Available OTPs in store:`, Array.from(emailOtpStore.keys()));

    // Verify OTP
    const storedOTP = emailOtpStore.get(normalizedEmail);
    
    if (!storedOTP) {
      console.log(`❌ No OTP found for email: ${normalizedEmail}\n`);
      return res.status(400).json({
        success: false,
        message: 'OTP not found or expired'
      });
    }

    console.log(`🔍 Stored OTP: ${storedOTP.otp}`);
    console.log(`🔍 Expiry time: ${new Date(storedOTP.expiresAt).toLocaleString()}`);

    if (Date.now() > storedOTP.expiresAt) {
      console.log(`❌ OTP expired for ${normalizedEmail}\n`);
      emailOtpStore.delete(normalizedEmail);
      return res.status(400).json({
        success: false,
        message: 'OTP expired'
      });
    }

    if (storedOTP.otp !== normalizedOTP) {
      console.log(`❌ Invalid OTP. Expected: ${storedOTP.otp}, Got: ${normalizedOTP}\n`);
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    console.log(`✅ OTP verified successfully for ${normalizedEmail}\n`);

    // Mark as verified for password reset (valid for 5 minutes)
    emailOtpStore.set(`verified_${normalizedEmail}`, {
      verified: true,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    // Delete OTP after successful verification
    emailOtpStore.delete(normalizedEmail);

    // Update user's email verification status if user exists in either collection
    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      user = await BusinessOwner.findOne({ email: normalizedEmail });
    }
    if (user) {
      user.emailVerified = true;
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password with OTP
// @route   POST /api/auth/reset-password-otp
// @access  Public
exports.resetPasswordWithOTP = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email was verified via OTP
    const verificationRecord = emailOtpStore.get(`verified_${normalizedEmail}`);
    
    if (!verificationRecord) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your email with OTP first'
      });
    }

    if (Date.now() > verificationRecord.expiresAt) {
      emailOtpStore.delete(`verified_${normalizedEmail}`);
      return res.status(400).json({
        success: false,
        message: 'Verification expired. Please request a new OTP'
      });
    }

    // Find user in both collections
    let user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    let userType = 'customer';
    
    if (!user) {
      user = await BusinessOwner.findOne({ email: normalizedEmail }).select('+passwordHash');
      if (user) {
        userType = 'business';
      }
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password
    user.passwordHash = password;
    await user.save();

    // Clear verification record
    emailOtpStore.delete(`verified_${normalizedEmail}`);

    // Generate auth token with userType
    const token = generateToken(user._id, userType);

    console.log(`✅ Password reset successful for ${normalizedEmail}`);

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }
    next(error);
  }
};

