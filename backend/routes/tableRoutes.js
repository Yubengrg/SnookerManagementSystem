const express = require('express');
const tableController = require('../controllers/tableController');
const { auth, requireEmailVerification } = require('../middleware/auth');
const {
  validateCreateTable,
  validateUpdateTable
} = require('../middleware/validation');

const router = express.Router();

// ===========================================
// PRIVATE ROUTES (Authentication Required)
// ===========================================

// @route   POST /api/tables/create
// @desc    Create a new table
// @access  Private (snooker house owner only)
router.post('/create', auth, requireEmailVerification, validateCreateTable, tableController.createTable);

// @route   GET /api/tables/my-tables
// @desc    Get all tables for user's snooker house
// @access  Private
router.get('/my-tables', auth, tableController.getMyTables);

// @route   GET /api/tables/:id
// @desc    Get single table by ID
// @access  Private (owner only)
router.get('/:id', auth, tableController.getTableById);

// @route   PUT /api/tables/:id
// @desc    Update table
// @access  Private (owner only)
router.put('/:id', auth, requireEmailVerification, validateUpdateTable, tableController.updateTable);

// @route   DELETE /api/tables/:id
// @desc    Delete table
// @access  Private (owner only)
router.delete('/:id', auth, requireEmailVerification, tableController.deleteTable);

// @route   GET /api/tables/stats/my-stats
// @desc    Get table statistics for user's snooker house
// @access  Private
router.get('/stats/my-stats', auth, tableController.getMyTableStats);

// ===========================================
// PUBLIC ROUTES (No Authentication Required)
// ===========================================

// @route   GET /api/tables/snooker-house/:id/tables
// @desc    Get all tables for a specific snooker house (public)
// @access  Public
router.get('/snooker-house/:id/tables', tableController.getSnookerHouseTables);

module.exports = router;