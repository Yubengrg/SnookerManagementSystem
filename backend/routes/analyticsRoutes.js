const express = require('express');
const BusinessAnalyticsController = require('../controllers/businessAnalyticsController'); // Import class
const { auth, requireEmailVerification } = require('../middleware/auth');
const {
  validateFinancialReportQuery,
  validateCustomerAnalyticsQuery,
  validateDashboardQuery
} = require('../middleware/analyticsValidation');

const router = express.Router();

// 🔧 FIX: Create an instance of the controller
const businessAnalyticsController = new BusinessAnalyticsController();

// ===========================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ===========================================

// Debug middleware
router.use((req, res, next) => {
  console.log('📊 Analytics Route:', {
    method: req.method,
    path: req.path,
    hasUser: !!req.user,
    userId: req.user?.id,
    userEmail: req.user?.email,
    query: req.query
  });
  next();
});

// ===========================================
// BUSINESS DASHBOARD ROUTES
// ===========================================

// @route   GET /api/analytics/dashboard
// @desc    Get comprehensive business dashboard
// @access  Private
// @query   refresh: boolean, includeComparisons: boolean, trendDays: number
router.get('/dashboard', 
  auth, 
  requireEmailVerification,
  validateDashboardQuery, 
  businessAnalyticsController.getDashboard.bind(businessAnalyticsController)
);

// @route   GET /api/analytics/financial-report
// @desc    Get detailed financial reports
// @access  Private
// @query   period: today|week|month|year|custom, startDate, endDate, format: json|csv|pdf
router.get('/financial-report', 
  auth, 
  requireEmailVerification,
  validateFinancialReportQuery, 
  businessAnalyticsController.getFinancialReport.bind(businessAnalyticsController)
);

// @route   GET /api/analytics/customer-analytics
// @desc    Get customer analytics and insights
// @access  Private
// @query   segment: all|vip|premium|regular|frequent|new, timeframe: week|month|quarter|year|all
router.get('/customer-analytics', 
  auth, 
  requireEmailVerification,
  validateCustomerAnalyticsQuery, 
  businessAnalyticsController.getCustomerAnalytics.bind(businessAnalyticsController)
);

module.exports = router;