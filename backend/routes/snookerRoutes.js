const express = require('express');
const snookerController = require('../controllers/snookerController');
const { auth, requireEmailVerification } = require('../middleware/auth');
const {
  validateCreateSnookerHouse,
  validateUpdateSnookerHouse
} = require('../middleware/validation');

const router = express.Router();

// ===========================================
// PRIVATE ROUTES (Authentication Required)
// ===========================================

// @route   POST /api/snooker/create
// @desc    Create a new snooker house
// @access  Private (logged-in users only)
router.post('/create', auth, requireEmailVerification, validateCreateSnookerHouse, snookerController.createSnookerHouse);

// @route   GET /api/snooker/my-house
// @desc    Get user's snooker house
// @access  Private
router.get('/my-house', auth, snookerController.getMySnookerHouse);

// @route   PUT /api/snooker/my-house
// @desc    Update user's snooker house
// @access  Private
router.put('/my-house', auth, requireEmailVerification, validateUpdateSnookerHouse, snookerController.updateMySnookerHouse);

// @route   DELETE /api/snooker/my-house
// @desc    Delete user's snooker house
// @access  Private
router.delete('/my-house', auth, requireEmailVerification, snookerController.deleteMySnookerHouse);

// ===========================================
// PUBLIC ROUTES (No Authentication Required)
// ===========================================

// @route   GET /api/snooker/houses
// @desc    Get all snooker houses (public)
// @access  Public
router.get('/houses', snookerController.getAllSnookerHouses);

// @route   GET /api/snooker/houses/:id
// @desc    Get single snooker house by ID
// @access  Public
router.get('/houses/:id', snookerController.getSnookerHouseById);

// @route   GET /api/snooker/stats
// @desc    Get snooker house statistics
// @access  Public
router.get('/stats', snookerController.getSnookerHouseStats);

module.exports = router;