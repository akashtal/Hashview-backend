const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const BusinessOwner = require('../models/BusinessOwner.model');

// Optional auth - Try to attach user if token exists, but don't fail if not
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token, just continue without setting req.user
    if (!token) {
      return next();
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from appropriate collection based on userType
      if (decoded.userType === 'business') {
        req.user = await BusinessOwner.findById(decoded.id).select('-passwordHash').populate('businesses');
      } else {
        req.user = await User.findById(decoded.id).select('-passwordHash');
        
        if (!req.user) {
          req.user = await BusinessOwner.findById(decoded.id).select('-passwordHash').populate('businesses');
        }
      }
    } catch (error) {
      // Invalid token, but continue anyway
      console.log('Invalid token in optional auth:', error.message);
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Protect routes - Verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from appropriate collection based on userType
      if (decoded.userType === 'business') {
        req.user = await BusinessOwner.findById(decoded.id).select('-passwordHash').populate('businesses');
      } else {
        // For customer, admin, or old tokens without userType
        req.user = await User.findById(decoded.id).select('-passwordHash');
        
        // If not found in User collection, try BusinessOwner (for backward compatibility)
        if (!req.user) {
          req.user = await BusinessOwner.findById(decoded.id).select('-passwordHash').populate('businesses');
        }
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (req.user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account is not active'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    console.log('🔐 Authorization Check:');
    console.log('   Required roles:', roles);
    console.log('   User role:', req.user?.role);
    console.log('   User ID:', req.user?.id || req.user?._id);
    console.log('   User type:', req.user?.constructor?.modelName);
    
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: 'User role not found. Please log in again.'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route. Required: ${roles.join(', ')}`
      });
    }
    next();
  };
};

// Optional auth - doesn't fail if no token
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from appropriate collection based on userType
        if (decoded.userType === 'business') {
          req.user = await BusinessOwner.findById(decoded.id).select('-passwordHash').populate('businesses');
        } else {
          req.user = await User.findById(decoded.id).select('-passwordHash');
          
          // If not found in User collection, try BusinessOwner
          if (!req.user) {
            req.user = await BusinessOwner.findById(decoded.id).select('-passwordHash').populate('businesses');
          }
        }
      } catch (error) {
        // Token invalid but continue anyway
        req.user = null;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

