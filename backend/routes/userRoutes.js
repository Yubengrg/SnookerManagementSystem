const express = require('express');
const userController = require('../controllers/userController');
const { auth, requireEmailVerification } = require('../middleware/auth');
const {
  validateProfileUpdate,
  validateChangePassword
} = require('../middleware/validation');

const router = express.Router();

// ===========================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ===========================================

// @route   GET /api/user/profile
// @desc    Get user profile with session info
// @access  Private
router.get('/profile', auth, userController.getProfile);

// @route   PUT /api/user/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, requireEmailVerification, validateProfileUpdate, userController.updateProfile);

// @route   PUT /api/user/change-password
// @desc    Change user password (invalidates all other sessions)
// @access  Private
router.put('/change-password', auth, requireEmailVerification, validateChangePassword, userController.changePassword);

// @route   POST /api/user/device-token
// @desc    Add/update device token for push notifications
// @access  Private
router.post('/device-token', auth, userController.addDeviceToken);

// @route   DELETE /api/user/device-token
// @desc    Remove device token
// @access  Private
router.delete('/device-token', auth, userController.removeDeviceToken);

// @route   GET /api/user/stats
// @desc    Get user statistics including session data
// @access  Private
router.get('/stats', auth, requireEmailVerification, userController.getStats);

// @route   GET /api/user/sessions
// @desc    Get user's sessions (alias for auth/sessions)
// @access  Private
router.get('/sessions', auth, userController.getSessions);

// @route   DELETE /api/user/account
// @desc    Delete user account (with all sessions and data)
// @access  Private
router.delete('/account', auth, requireEmailVerification, userController.deleteAccount);

// @route   POST /api/user/logout-device
// @desc    Logout specific device/session
// @access  Private
router.post('/logout-device', auth, userController.logoutDevice);

// @route   GET /api/user/security
// @desc    Get user security information
// @access  Private
router.get('/security', auth, userController.getSecurityInfo);

// @route   POST /api/user/security/logout-all-others
// @desc    Logout all other sessions (security action)
// @access  Private
router.post('/security/logout-all-others', auth, userController.securityLogoutAllOthers);

module.exports = router;