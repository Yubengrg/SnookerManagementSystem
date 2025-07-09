const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const OTP = require('../models/OTP');
const emailService = require('../services/emailService');
const { extractDeviceInfo, generateSessionToken, invalidateCurrentSession } = require('../middleware/auth');

class AuthController {
  // @desc    Register a new user
  // @access  Public
  async signup(req, res) {
    try {
      const { firstName, lastName, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Create new user
      const user = new User({
        firstName,
        lastName,
        email,
        password
      });

      await user.save();

      // Generate and send OTP
      const otpDoc = await OTP.createOTP(email, 'signup');
      
      // Send OTP via email
      const emailResult = await emailService.sendOTP(email, otpDoc.otp, 'signup');
      
      if (!emailResult.success) {
        console.error('Failed to send OTP email:', emailResult.error);
      }

      res.status(201).json({
        success: true,
        message: 'User created successfully. OTP sent to your email address.',
        data: {
          userId: user._id,
          email: user.email,
          otpSent: emailResult.success
        }
      });

    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during signup',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // @desc    Login user
  // @access  Public
  async login(req, res) {
    try {
      const { email, password, rememberMe = false } = req.body;

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if account is locked
      if (user.isLocked()) {
        return res.status(423).json({
          success: false,
          message: 'Account is temporarily locked. Please try again later.'
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        await user.incrementOtpAttempts();
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if email is verified
      if (!user.isEmailVerified) {
        // Generate and send OTP for email verification
        const otpDoc = await OTP.createOTP(email, 'email_verification');
        const emailResult = await emailService.sendOTP(email, otpDoc.otp, 'email_verification');
        
        return res.status(200).json({
          success: true,
          message: 'Email verification required. OTP sent to your email address.',
          requiresVerification: true,
          data: {
            email: user.email,
            otpSent: emailResult.success
          }
        });
      }

      // Reset OTP attempts on successful login
      await user.resetOtpAttempts();
      await user.updateLastLogin();

      // Extract device information and create session
      const deviceInfo = extractDeviceInfo(req);
      const { token, sessionId } = await generateSessionToken(user._id, deviceInfo, rememberMe);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          sessionId,
          user: user.toJSON(),
          sessionCreated: true
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login'
      });
    }
  }

  // @desc    Verify OTP
  // @access  Public
  async verifyOTP(req, res) {
    try {
      const { email, otp, purpose, rememberMe = false } = req.body;

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if account is locked
      if (user.isLocked()) {
        return res.status(423).json({
          success: false,
          message: 'Account is temporarily locked due to too many failed attempts'
        });
      }

      // Verify OTP
      const otpResult = await OTP.verifyOTP(email, otp, purpose);
      
      if (!otpResult.success) {
        await user.incrementOtpAttempts();
        return res.status(400).json({
          success: false,
          message: otpResult.message
        });
      }

      // Reset OTP attempts on successful verification
      await user.resetOtpAttempts();

      // Mark email as verified if it's signup verification
      if (purpose === 'signup' || purpose === 'email_verification') {
        user.isEmailVerified = true;
        await user.save();
      }

      // Update last login
      await user.updateLastLogin();

      // Extract device information and create session
      const deviceInfo = extractDeviceInfo(req);
      const { token, sessionId } = await generateSessionToken(user._id, deviceInfo, rememberMe);

      res.json({
        success: true,
        message: 'OTP verified successfully',
        data: {
          token,
          sessionId,
          user: user.toJSON(),
          sessionCreated: true
        }
      });

    } catch (error) {
      console.error('OTP verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during OTP verification'
      });
    }
  }

  // @desc    Resend OTP
  // @access  Public
  async resendOTP(req, res) {
    try {
      const { email, purpose = 'signup' } = req.body;

      // Check rate limiting
      const canSend = await OTP.canSendOTP(email, purpose);
      if (!canSend.canSend) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${canSend.waitTime} seconds before requesting another OTP`
        });
      }

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Generate and send new OTP
      const otpDoc = await OTP.createOTP(email, purpose);
      const emailResult = await emailService.sendOTP(email, otpDoc.otp, purpose);

      res.json({
        success: true,
        message: 'OTP resent successfully',
        data: {
          email,
          otpSent: emailResult.success
        }
      });

    } catch (error) {
      console.error('Resend OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while resending OTP'
      });
    }
  }

  // @desc    Send OTP for password reset
  // @access  Public
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        return res.json({
          success: true,
          message: 'If this email is registered, you will receive an OTP'
        });
      }

      // Check rate limiting
      const canSend = await OTP.canSendOTP(email, 'password_reset');
      if (!canSend.canSend) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${canSend.waitTime} seconds before requesting another OTP`
        });
      }

      // Generate and send OTP
      const otpDoc = await OTP.createOTP(email, 'password_reset');
      const emailResult = await emailService.sendOTP(email, otpDoc.otp, 'password_reset');

      res.json({
        success: true,
        message: 'If this email is registered, you will receive an OTP',
        data: {
          otpSent: emailResult.success
        }
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Reset password with OTP
  // @access  Public
  async resetPassword(req, res) {
    try {
      const { email, otp, newPassword } = req.body;

      // Validate input
      if (!email || !otp || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Email, OTP, and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Verify OTP
      const otpResult = await OTP.verifyOTP(email, otp, 'password_reset');
      if (!otpResult.success) {
        return res.status(400).json({
          success: false,
          message: otpResult.message
        });
      }

      // Find and update user
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Invalidate all user sessions (force re-login after password reset)
      await UserSession.invalidateUserSessions(user._id);

      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password reset successfully. Please login again.'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during password reset'
      });
    }
  }

  // @desc    Logout user
  // @access  Private
  async logout(req, res) {
    try {
      // Invalidate current session
      await invalidateCurrentSession(req.tokenHash);
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during logout'
      });
    }
  }

  // @desc    Get user sessions
  // @access  Private
  async getSessions(req, res) {
    try {
      const sessions = await UserSession.getUserSessions(req.user.id);
      
      const sessionsWithCurrent = sessions.map(session => ({
        ...session.toJSON(),
        isCurrent: session.sessionId === req.session.id
      }));

      // Get session statistics
      const totalSessions = sessionsWithCurrent.length;
      const rememberMeSessions = sessionsWithCurrent.filter(s => s.rememberMe).length;
      const recentSessions = sessionsWithCurrent.filter(s => 
        new Date(s.lastActivity) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length;

      res.json({
        success: true,
        data: {
          sessions: sessionsWithCurrent,
          currentSessionId: req.session.id,
          statistics: {
            total: totalSessions,
            rememberMe: rememberMeSessions,
            recentlyActive: recentSessions
          }
        }
      });
    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Logout specific session
  // @access  Private
  async logoutSession(req, res) {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required'
        });
      }

      // Verify session belongs to user
      const session = await UserSession.findOne({ 
        sessionId, 
        user: req.user.id,
        isActive: true 
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      await UserSession.invalidateSession(sessionId);
      
      res.json({
        success: true,
        message: 'Session logged out successfully',
        loggedOutSessionId: sessionId
      });
    } catch (error) {
      console.error('Logout session error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during logout'
      });
    }
  }

  // @desc    Logout all other sessions except current
  // @access  Private
  async logoutOthers(req, res) {
    try {
      const result = await UserSession.invalidateUserSessions(req.user.id, req.session.id);
      
      res.json({
        success: true,
        message: `Successfully logged out ${result.modifiedCount} other sessions`,
        loggedOutCount: result.modifiedCount
      });
    } catch (error) {
      console.error('Logout others error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Logout all sessions including current
  // @access  Private
  async logoutAll(req, res) {
    try {
      const result = await UserSession.invalidateUserSessions(req.user.id);
      
      res.json({
        success: true,
        message: `Successfully logged out all ${result.modifiedCount} sessions`,
        loggedOutCount: result.modifiedCount
      });
    } catch (error) {
      console.error('Logout all error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Extend current session
  // @access  Private
  async extendSession(req, res) {
    try {
      const { hours = 168 } = req.body; // Default 7 days
      
      // Find current session
      const session = await UserSession.findOne({
        sessionId: req.session.id,
        isActive: true
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Extend session
      await session.extendSession(hours);
      
      res.json({
        success: true,
        message: 'Session extended successfully',
        data: {
          newExpiresAt: session.expiresAt,
          hoursExtended: hours
        }
      });
    } catch (error) {
      console.error('Extend session error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Get current session information
  // @access  Private
  async getSessionInfo(req, res) {
    try {
      const session = await UserSession.findOne({
        sessionId: req.session.id,
        isActive: true
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      res.json({
        success: true,
        data: {
          session: session.toJSON(),
          user: req.user,
          timeLeft: Math.max(0, Math.floor((session.expiresAt - new Date()) / (1000 * 60 * 60))), // hours
          isExpiringSoon: session.expiresAt < new Date(Date.now() + 24 * 60 * 60 * 1000) // within 24 hours
        }
      });
    } catch (error) {
      console.error('Get session info error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Get current user
  // @access  Private
  async getMe(req, res) {
    try {
      const user = await User.findById(req.user.id).select('-password');
      
      res.json({
        success: true,
        data: { 
          user,
          session: req.session
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
}

module.exports = new AuthController();