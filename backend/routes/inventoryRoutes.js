const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { auth, requireEmailVerification } = require('../middleware/auth');

const router = express.Router();

// ===========================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ===========================================

// Debug middleware
router.use((req, res, next) => {
  console.log('📦 Inventory Route:', {
    method: req.method,
    path: req.path,
    hasUser: !!req.user,
    userId: req.user?.id,
    userEmail: req.user?.email
  });
  next();
});

// ===========================================
// PRODUCT MANAGEMENT ROUTES
// ===========================================

// @route   POST /api/inventory/products
// @desc    Create a new product
// @access  Private (snooker house owner only)
router.post('/products', auth, requireEmailVerification, inventoryController.createProduct);

// @route   GET /api/inventory/products
// @desc    Get all products for user's snooker house
// @access  Private
router.get('/products', auth, inventoryController.getMyProducts);

// @route   GET /api/inventory/products/search
// @desc    Search products
// @access  Private
router.get('/products/search', auth, inventoryController.searchProducts);

// @route   GET /api/inventory/products/low-stock
// @desc    Get low stock products
// @access  Private
router.get('/products/low-stock', auth, inventoryController.getLowStockProducts);

// @route   PUT /api/inventory/products/:productId
// @desc    Update product
// @access  Private (owner only)
router.put('/products/:productId', auth, requireEmailVerification, inventoryController.updateProduct);

// @route   PUT /api/inventory/products/:productId/stock
// @desc    Update product stock
// @access  Private (owner only)
router.put('/products/:productId/stock', auth, requireEmailVerification, inventoryController.updateStock);

// @route   DELETE /api/inventory/products/:productId
// @desc    Delete product
// @access  Private (owner only)
router.delete('/products/:productId', auth, requireEmailVerification, inventoryController.deleteProduct);

// ===========================================
// SALES MANAGEMENT ROUTES
// ===========================================

// @route   POST /api/inventory/sales
// @desc    Record a sale
// @access  Private
router.post('/sales', auth, requireEmailVerification, inventoryController.recordSale);

// @route   GET /api/inventory/sales
// @desc    Get sales history
// @access  Private
router.get('/sales', auth, inventoryController.getSalesHistory);

// ===========================================
// STATISTICS ROUTES
// ===========================================

// @route   GET /api/inventory/stats
// @desc    Get inventory statistics
// @access  Private
router.get('/stats', auth, inventoryController.getInventoryStats);

module.exports = router;