const express = require('express');
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const {
  validateSignup,
  validateLogin,
  validateOTP,
  validateEmail
} = require('../middleware/validation');

const router = express.Router();

// ===========================================
// PUBLIC ROUTES (No Authentication Required)
// ===========================================

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', validateSignup, authController.signup);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateLogin, authController.login);

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP for signup/login
// @access  Public
router.post('/verify-otp', validateOTP, authController.verifyOTP);

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP
// @access  Public
router.post('/resend-otp', validateEmail, authController.resendOTP);

// @route   POST /api/auth/forgot-password
// @desc    Send OTP for password reset
// @access  Public
router.post('/forgot-password', validateEmail, authController.forgotPassword);

// @route   POST /api/auth/reset-password
// @desc    Reset password with OTP
// @access  Public
router.post('/reset-password', authController.resetPassword);

// ===========================================
// PRIVATE ROUTES (Authentication Required)
// ===========================================

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, authController.getMe);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', auth, authController.logout);

// @route   GET /api/auth/sessions
// @desc    Get user sessions
// @access  Private
router.get('/sessions', auth, authController.getSessions);

// @route   POST /api/auth/logout-session
// @desc    Logout specific session
// @access  Private
router.post('/logout-session', auth, authController.logoutSession);

// @route   POST /api/auth/logout-others
// @desc    Logout all other sessions except current
// @access  Private
router.post('/logout-others', auth, authController.logoutOthers);

// @route   POST /api/auth/logout-all
// @desc    Logout all sessions including current
// @access  Private
router.post('/logout-all', auth, authController.logoutAll);

// @route   POST /api/auth/extend-session
// @desc    Extend current session
// @access  Private
router.post('/extend-session', auth, authController.extendSession);

// @route   GET /api/auth/session-info
// @desc    Get current session information
// @access  Private
router.get('/session-info', auth, authController.getSessionInfo);

module.exports = router;