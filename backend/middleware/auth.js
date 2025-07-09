const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const UserSession = require('../models/UserSession');
const User = require('../models/User');

// Helper function to hash JWT token
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Helper function to extract device information from request
const extractDeviceInfo = (req) => {
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  
  // Parse user agent for browser and OS info
  let browser = 'Unknown';
  let os = 'Unknown';
  let platform = req.get('X-Platform') || 'web';
  
  // Simple browser detection
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  else if (userAgent.includes('Opera')) browser = 'Opera';
  
  // Simple OS detection
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS')) os = 'iOS';
  
  return {
    userAgent,
    ip,
    platform,
    browser,
    os,
    location: '' // Can be filled by IP geolocation service
  };
};

// Main authentication middleware with session tracking
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Hash token for session lookup
    const tokenHash = hashToken(token);
    
    // Find active session
    const session = await UserSession.findByToken(tokenHash);
    
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session',
        code: 'SESSION_EXPIRED'
      });
    }

    // Check if session is expired
    if (session.isExpired()) {
      // Mark session as inactive
      session.isActive = false;
      await session.save();
      
      return res.status(401).json({
        success: false,
        message: 'Session has expired',
        code: 'SESSION_EXPIRED'
      });
    }

    // Check if user account is locked
    if (session.user.isLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Update session activity (async, don't wait)
    session.updateActivity().catch(err => {
      console.error('Failed to update session activity:', err);
    });

    // Add user and session info to request object
    // 🔧 FIX: Ensure all IDs are strings to prevent ObjectId comparison issues
    req.user = {
      id: session.user._id.toString(), // ← FIXED: Convert ObjectId to string
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      isEmailVerified: session.user.isEmailVerified
    };
    
    req.session = {
      id: session.sessionId,
      deviceInfo: session.deviceInfo,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      rememberMe: session.rememberMe,
      expiresAt: session.expiresAt
    };

    // Add token hash to request for logout operations
    req.tokenHash = tokenHash;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const tokenHash = hashToken(token);
        const session = await UserSession.findByToken(tokenHash);
        
        if (session && !session.isExpired() && !session.user.isLocked()) {
          // 🔧 FIX: Ensure all IDs are strings here too
          req.user = {
            id: session.user._id.toString(), // ← FIXED: Convert ObjectId to string
            email: session.user.email,
            firstName: session.user.firstName,
            lastName: session.user.lastName,
            isEmailVerified: session.user.isEmailVerified
          };
          
          req.session = {
            id: session.sessionId,
            deviceInfo: session.deviceInfo,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            rememberMe: session.rememberMe,
            expiresAt: session.expiresAt
          };

          req.tokenHash = tokenHash;
          
          // Update activity
          session.updateActivity().catch(err => {
            console.error('Failed to update session activity:', err);
          });
        }
      } catch (error) {
        // Continue without authentication if token is invalid
        console.log('Optional auth failed, continuing without auth:', error.message);
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication on any error
    next();
  }
};

// Middleware to require email verification with session
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required',
      requiresVerification: true
    });
  }
  
  next();
};

// Utility function to generate session token
const generateSessionToken = async (userId, deviceInfo, rememberMe = false) => {
  const expiryHours = rememberMe ? 720 : 168; // 30 days vs 7 days
  const token = jwt.sign(
    { userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: rememberMe ? '30d' : '7d' }
  );
  
  const tokenHash = hashToken(token);
  const session = await UserSession.createSession(userId, tokenHash, deviceInfo, expiryHours, rememberMe);
  
  return { token, sessionId: session.sessionId, session };
};

// Utility function to invalidate current session
const invalidateCurrentSession = async (tokenHash) => {
  const session = await UserSession.findOne({ tokenHash, isActive: true });
  if (session) {
    session.isActive = false;
    await session.save();
  }
  return session;
};

module.exports = {
  auth,
  optionalAuth,
  requireEmailVerification,
  hashToken,
  extractDeviceInfo,
  generateSessionToken,
  invalidateCurrentSession
};