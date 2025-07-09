const express = require('express');
const sessionController = require('../controllers/sessionController');
const { auth, requireEmailVerification } = require('../middleware/auth');
const {
  validateStartSession,
  validateUpdateSession,
  validateEndSession,
  validateAddItemToSession,
  validateConfirmPayment // 🆕 NEW: Payment validation
} = require('../middleware/validation');

const router = express.Router();

// ===========================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ===========================================

// Debug middleware to understand authentication issues
router.use((req, res, next) => {
  console.log('🔍 Sessions Debug:', {
    method: req.method,
    path: req.path,
    hasUser: !!req.user,
    userId: req.user?.id,
    userEmail: req.user?.email,
    hasSession: !!req.session,
    sessionId: req.session?.id,
    headers: {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      contentType: req.headers['content-type']
    }
  });
  next();
});

// ===========================================
// SESSION MANAGEMENT ROUTES
// ===========================================

// @route   POST /api/sessions/start
// @desc    Start a new session
// @access  Private (table owner only)
router.post('/start', auth, requireEmailVerification, validateStartSession, sessionController.startSession);

// @route   GET /api/sessions/active/:tableId
// @desc    Get active session for a table
// @access  Private (table owner only)
router.get('/active/:tableId', auth, sessionController.getActiveSession);

// @route   PUT /api/sessions/:sessionId
// @desc    Update session (add frames/kittis, pause/resume, add notes)
// @access  Private (session owner only)
router.put('/:sessionId', auth, requireEmailVerification, validateUpdateSession, sessionController.updateSession);

// 🆕 NEW: Payment confirmation route
// @route   POST /api/sessions/:sessionId/confirm-payment
// @desc    Confirm payment details before ending session
// @access  Private (session owner only)
router.post('/:sessionId/confirm-payment', auth, requireEmailVerification, validateConfirmPayment, sessionController.confirmPayment);

// @route   POST /api/sessions/:sessionId/end
// @desc    End a session (requires payment confirmation)
// @access  Private (session owner only)
router.post('/:sessionId/end', auth, requireEmailVerification, validateEndSession, sessionController.endSession);

// @route   GET /api/sessions/my-sessions
// @desc    Get all sessions for user's snooker house with filtering and pagination
// @access  Private
router.get('/my-sessions', auth, sessionController.getMySessions);

// @route   DELETE /api/sessions/:sessionId
// @desc    Cancel/Delete a session (only if not completed)
// @access  Private
router.delete('/:sessionId', auth, requireEmailVerification, sessionController.cancelSession);

// @route   GET /api/sessions/stats
// @desc    Get session statistics for user's snooker house
// @access  Private
router.get('/stats', auth, sessionController.getSessionStats);

// 🆕 NEW: Payment summary route
// @route   GET /api/sessions/payment-summary
// @desc    Get payment summary and statistics
// @access  Private
router.get('/payment-summary', auth, sessionController.getPaymentSummary);

// @route   GET /api/sessions/:sessionId
// @desc    Get specific session details
// @access  Private (session owner only)
router.get('/:sessionId', auth, sessionController.getSessionById);

// @route   POST /api/sessions/:sessionId/pause
// @desc    Pause an active session
// @access  Private (session owner only)
router.post('/:sessionId/pause', auth, requireEmailVerification, sessionController.pauseSession);

// @route   POST /api/sessions/:sessionId/resume
// @desc    Resume a paused session
// @access  Private (session owner only)
router.post('/:sessionId/resume', auth, requireEmailVerification, sessionController.resumeSession);

// ===========================================
// SESSION ITEM MANAGEMENT ROUTES
// ===========================================

// @route   POST /api/sessions/:sessionId/items
// @desc    Add item to active session
// @access  Private (session owner only)
router.post('/:sessionId/items', auth, requireEmailVerification, validateAddItemToSession, sessionController.addItemToSession);

// @route   DELETE /api/sessions/:sessionId/items/:itemId
// @desc    Remove item from active session
// @access  Private (session owner only)
router.delete('/:sessionId/items/:itemId', auth, requireEmailVerification, sessionController.removeItemFromSession);

// ===========================================
// SESSION HISTORY & ANALYTICS ROUTES
// ===========================================

// @route   GET /api/sessions/table/:tableId/history
// @desc    Get session history for a specific table
// @access  Private (table owner only)
router.get('/table/:tableId/history', auth, sessionController.getTableSessionHistory);

// @route   GET /api/sessions/export
// @desc    Export session data (CSV/JSON) with payment information
// @access  Private
router.get('/export', auth, sessionController.exportSessions);

// @route   POST /api/sessions/bulk-action
// @desc    Perform bulk actions on multiple sessions
// @access  Private
router.post('/bulk-action', auth, requireEmailVerification, sessionController.bulkSessionAction);

module.exports = router;