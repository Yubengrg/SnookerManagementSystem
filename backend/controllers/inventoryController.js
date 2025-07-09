const Product = require('../models/Product');
const Sale = require('../models/Sale');
const SnookerHouse = require('../models/SnookerHouse');

class InventoryController {
  // @desc    Create a new product
  // @access  Private (snooker house owner only)
  async createProduct(req, res) {
    try {
      const { 
        name, 
        barcode, 
        category, 
        costPrice, 
        sellingPrice, 
        currentStock, 
        minStockLevel, 
        unit, 
        description, 
        productImage 
      } = req.body;

      console.log('📦 Creating product:', name);

      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'You need to create a snooker house first'
        });
      }

      // Check if product with same name exists in this snooker house
      const existingProduct = await Product.findOne({
        snookerHouse: snookerHouse._id,
        name: name.trim()
      });

      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'A product with this name already exists'
        });
      }

      // Check barcode uniqueness if provided
      if (barcode && barcode.trim()) {
        const existingBarcode = await Product.findOne({
          snookerHouse: snookerHouse._id,
          barcode: barcode.trim()
        });

        if (existingBarcode) {
          return res.status(400).json({
            success: false,
            message: 'A product with this barcode already exists'
          });
        }
      }

      // Validate pricing
      if (costPrice < 0 || sellingPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'Prices cannot be negative'
        });
      }

      // Create product
      const product = new Product({
        name: name.trim(),
        barcode: barcode?.trim() || undefined,
        category,
        costPrice: parseFloat(costPrice),
        sellingPrice: parseFloat(sellingPrice),
        currentStock: parseInt(currentStock) || 0,
        minStockLevel: parseInt(minStockLevel) || 5,
        unit: unit || 'piece',
        description: description?.trim() || '',
        productImage: productImage?.trim() || '',
        snookerHouse: snookerHouse._id,
        owner: req.user.id
      });

      await product.save();

      console.log('✅ Product created:', product.name);

      res.status(201).json({
        success: true,
        message: 'Product created successfully!',
        data: {
          product: product.toJSON(),
          createdBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Create product error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during product creation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // @desc    Get all products for user's snooker house
  // @access  Private
  async getMyProducts(req, res) {
    try {
      const { category, status, lowStock, limit = 100, skip = 0 } = req.query;

      console.log('📦 Getting products with filters:', { category, status, lowStock });

      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      const options = {
        limit: parseInt(limit),
        skip: parseInt(skip)
      };

      if (category) options.category = category;
      if (status) options.status = status;
      if (lowStock === 'true') options.lowStock = true;

      const products = await Product.findBySnookerHouse(snookerHouse._id, options);

      // Calculate summary stats
      const totalProducts = await Product.countDocuments({ snookerHouse: snookerHouse._id });
      const activeProducts = await Product.countDocuments({ 
        snookerHouse: snookerHouse._id, 
        status: 'active' 
      });
      const lowStockProducts = await Product.countDocuments({
        snookerHouse: snookerHouse._id,
        $expr: { $lte: ['$currentStock', '$minStockLevel'] }
      });

      // Calculate total stock value
      const stockValueResult = await Product.aggregate([
        { $match: { snookerHouse: snookerHouse._id } },
        {
          $group: {
            _id: null,
            totalStockValue: { $sum: { $multiply: ['$currentStock', '$costPrice'] } },
            totalPotentialRevenue: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } }
          }
        }
      ]);

      const stockStats = stockValueResult[0] || { 
        totalStockValue: 0, 
        totalPotentialRevenue: 0 
      };

      console.log('✅ Products retrieved:', products.length);

      res.json({
        success: true,
        data: {
          products: products.map(product => product.toJSON()),
          statistics: {
            total: totalProducts,
            active: activeProducts,
            lowStock: lowStockProducts,
            returned: products.length,
            totalStockValue: Math.round(stockStats.totalStockValue),
            totalPotentialRevenue: Math.round(stockStats.totalPotentialRevenue),
            totalPotentialProfit: Math.round(stockStats.totalPotentialRevenue - stockStats.totalStockValue)
          },
          pagination: {
            limit: parseInt(limit),
            skip: parseInt(skip),
            hasMore: products.length === parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('💥 Get products error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Update product
  // @access  Private (owner only)
  async updateProduct(req, res) {
    try {
      const { productId } = req.params;
      const updateData = req.body;

      console.log('📦 Updating product:', productId);

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Check ownership
      if (product.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only update your own products.'
        });
      }

      // Check for name uniqueness if name is being updated
      if (updateData.name && updateData.name.trim() !== product.name) {
        const existingProduct = await Product.findOne({
          snookerHouse: product.snookerHouse,
          name: updateData.name.trim(),
          _id: { $ne: productId }
        });

        if (existingProduct) {
          return res.status(400).json({
            success: false,
            message: 'A product with this name already exists'
          });
        }
      }

      // Check for barcode uniqueness if barcode is being updated
      if (updateData.barcode && updateData.barcode.trim() !== product.barcode) {
        const existingBarcode = await Product.findOne({
          snookerHouse: product.snookerHouse,
          barcode: updateData.barcode.trim(),
          _id: { $ne: productId }
        });

        if (existingBarcode) {
          return res.status(400).json({
            success: false,
            message: 'A product with this barcode already exists'
          });
        }
      }

      // Update allowed fields
      const allowedUpdates = [
        'name', 'barcode', 'category', 'costPrice', 'sellingPrice', 
        'currentStock', 'minStockLevel', 'unit', 'status', 'description', 'productImage'
      ];

      allowedUpdates.forEach(field => {
        if (updateData[field] !== undefined) {
          if (field === 'name' || field === 'barcode' || field === 'description' || field === 'productImage') {
            product[field] = updateData[field]?.trim() || '';
          } else if (field === 'costPrice' || field === 'sellingPrice') {
            product[field] = parseFloat(updateData[field]) || 0;
          } else if (field === 'currentStock' || field === 'minStockLevel') {
            product[field] = parseInt(updateData[field]) || 0;
          } else {
            product[field] = updateData[field];
          }
        }
      });

      await product.save();

      console.log('✅ Product updated:', product.name);

      res.json({
        success: true,
        message: 'Product updated successfully!',
        data: {
          product: product.toJSON(),
          updatedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Update product error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during update'
      });
    }
  }

  // @desc    Delete product
  // @access  Private (owner only)
  async deleteProduct(req, res) {
    try {
      const { productId } = req.params;

      console.log('🗑️ Deleting product:', productId);

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Check ownership
      if (product.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only delete your own products.'
        });
      }

      // Check if product has been sold (has sales records)
      const salesCount = await Sale.countDocuments({
        'items.product': productId
      });

      if (salesCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete product that has sales records. Consider marking it as discontinued instead.'
        });
      }

      await Product.findByIdAndDelete(productId);

      console.log('✅ Product deleted:', product.name);

      res.json({
        success: true,
        message: 'Product deleted successfully',
        data: {
          deletedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Delete product error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during deletion'
      });
    }
  }

  // @desc    Record a sale
  // @access  Private
  async recordSale(req, res) {
    try {
      const { items, paymentMethod, customerName, customerPhone, notes, sessionId } = req.body;

      console.log('💰 Recording sale with', items?.length, 'items');

      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      // Validate items
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one item is required'
        });
      }

      // Process sale items and validate stock
      const saleItems = [];
      const productUpdates = [];

      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Product not found: ${item.productId}`
          });
        }

        // Check ownership
        if (product.owner.toString() !== req.user.id) {
          return res.status(403).json({
            success: false,
            message: `Access denied for product: ${product.name}`
          });
        }

        // Check stock availability
        if (product.currentStock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}. Available: ${product.currentStock}, Requested: ${item.quantity}`
          });
        }

        // Use current product prices (not the ones from frontend)
        const costPrice = product.costPrice;
        const sellingPrice = product.sellingPrice;
        const totalCost = costPrice * item.quantity;
        const totalRevenue = sellingPrice * item.quantity;
        const profit = totalRevenue - totalCost;

        saleItems.push({
          product: product._id,
          productName: product.name,
          quantity: item.quantity,
          costPrice,
          sellingPrice,
          totalCost,
          totalRevenue,
          profit
        });

        // Prepare stock update
        productUpdates.push({
          productId: product._id,
          newStock: product.currentStock - item.quantity
        });
      }

      // Generate sale number
      const saleNumber = await Sale.generateSaleNumber(snookerHouse._id);

      // Create sale record
      const sale = new Sale({
        saleNumber,
        snookerHouse: snookerHouse._id,
        owner: req.user.id,
        session: sessionId || null,
        items: saleItems,
        paymentMethod: paymentMethod || 'cash',
        customerName: customerName?.trim() || '',
        customerPhone: customerPhone?.trim() || '',
        notes: notes?.trim() || '',
        createdBySession: req.session?.id
      });

      // Calculate totals
      sale.calculateTotals();

      // Save sale
      await sale.save();

      // Update product stocks
      for (const update of productUpdates) {
        await Product.findByIdAndUpdate(update.productId, {
          currentStock: update.newStock
        });
      }

      // Populate product details for response
      await sale.populate('items.product', 'name category unit');

      console.log('✅ Sale recorded:', sale.saleNumber, 'Total profit:', sale.totalProfit);

      res.status(201).json({
        success: true,
        message: 'Sale recorded successfully!',
        data: {
          sale: sale.toObject(),
          createdBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Record sale error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during sale recording',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // @desc    Get sales history
  // @access  Private
  async getSalesHistory(req, res) {
    try {
      const { 
        dateFrom, 
        dateTo, 
        paymentMethod, 
        limit = 50, 
        skip = 0 
      } = req.query;

      console.log('💰 Getting sales history with filters');

      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      const options = {
        limit: parseInt(limit),
        skip: parseInt(skip)
      };

      if (dateFrom) options.dateFrom = dateFrom;
      if (dateTo) options.dateTo = dateTo;
      if (paymentMethod) options.paymentMethod = paymentMethod;

      const sales = await Sale.getSalesBySnookerHouse(snookerHouse._id, options);

      // Get sales statistics
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [totalSales, todaySales, monthSales, salesStats] = await Promise.all([
        Sale.countDocuments({ snookerHouse: snookerHouse._id }),
        Sale.countDocuments({
          snookerHouse: snookerHouse._id,
          saleDate: { $gte: startOfDay, $lte: endOfDay }
        }),
        Sale.countDocuments({
          snookerHouse: snookerHouse._id,
          saleDate: { $gte: startOfMonth }
        }),
        Sale.aggregate([
          { $match: { snookerHouse: snookerHouse._id } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$totalRevenue' },
              totalProfit: { $sum: '$totalProfit' },
              totalCost: { $sum: '$totalCost' },
              averageSale: { $avg: '$totalRevenue' }
            }
          }
        ])
      ]);

      const stats = salesStats[0] || {
        totalRevenue: 0,
        totalProfit: 0,
        totalCost: 0,
        averageSale: 0
      };

      console.log('✅ Sales history retrieved:', sales.length);

      res.json({
        success: true,
        data: {
          sales,
          statistics: {
            total: totalSales,
            today: todaySales,
            thisMonth: monthSales,
            returned: sales.length,
            totalRevenue: Math.round(stats.totalRevenue),
            totalProfit: Math.round(stats.totalProfit),
            totalCost: Math.round(stats.totalCost),
            averageSale: Math.round(stats.averageSale)
          },
          pagination: {
            limit: parseInt(limit),
            skip: parseInt(skip),
            hasMore: sales.length === parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('💥 Get sales history error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Get inventory statistics
  // @access  Private
  async getInventoryStats(req, res) {
    try {
      console.log('📊 Getting inventory statistics');

      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      // Get product statistics
      const [
        totalProducts,
        activeProducts,
        lowStockProducts,
        stockValueStats,
        categoryStats,
        salesStats
      ] = await Promise.all([
        Product.countDocuments({ snookerHouse: snookerHouse._id }),
        Product.countDocuments({ snookerHouse: snookerHouse._id, status: 'active' }),
        Product.countDocuments({
          snookerHouse: snookerHouse._id,
          $expr: { $lte: ['$currentStock', '$minStockLevel'] }
        }),
        Product.aggregate([
          { $match: { snookerHouse: snookerHouse._id } },
          {
            $group: {
              _id: null,
              totalStockValue: { $sum: { $multiply: ['$currentStock', '$costPrice'] } },
              totalPotentialRevenue: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } },
              totalItems: { $sum: '$currentStock' }
            }
          }
        ]),
        Product.aggregate([
          { $match: { snookerHouse: snookerHouse._id } },
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
              totalStock: { $sum: '$currentStock' },
              totalValue: { $sum: { $multiply: ['$currentStock', '$costPrice'] } }
            }
          }
        ]),
        Sale.aggregate([
          { $match: { snookerHouse: snookerHouse._id } },
          {
            $group: {
              _id: null,
              totalSales: { $sum: 1 },
              totalRevenue: { $sum: '$totalRevenue' },
              totalProfit: { $sum: '$totalProfit' }
            }
          }
        ])
      ]);

      const stockStats = stockValueStats[0] || {
        totalStockValue: 0,
        totalPotentialRevenue: 0,
        totalItems: 0
      };

      const salesSummary = salesStats[0] || {
        totalSales: 0,
        totalRevenue: 0,
        totalProfit: 0
      };

      const stats = {
        products: {
          total: totalProducts,
          active: activeProducts,
          lowStock: lowStockProducts,
          totalItems: stockStats.totalItems
        },
        inventory: {
          totalStockValue: Math.round(stockStats.totalStockValue),
          totalPotentialRevenue: Math.round(stockStats.totalPotentialRevenue),
          totalPotentialProfit: Math.round(stockStats.totalPotentialRevenue - stockStats.totalStockValue)
        },
        sales: {
          totalSales: salesSummary.totalSales,
          totalRevenue: Math.round(salesSummary.totalRevenue),
          totalProfit: Math.round(salesSummary.totalProfit)
        },
        categories: categoryStats.map(cat => ({
          category: cat._id,
          productCount: cat.count,
          totalStock: cat.totalStock,
          totalValue: Math.round(cat.totalValue)
        }))
      };

      console.log('✅ Inventory statistics retrieved');

      res.json({
        success: true,
        data: { stats }
      });

    } catch (error) {
      console.error('💥 Get inventory stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Get low stock products
  // @access  Private
  async getLowStockProducts(req, res) {
    try {
      console.log('⚠️ Getting low stock products');

      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      const lowStockProducts = await Product.find({
        snookerHouse: snookerHouse._id,
        status: 'active',
        $expr: { $lte: ['$currentStock', '$minStockLevel'] }
      }).sort({ currentStock: 1 });

      console.log('✅ Low stock products retrieved:', lowStockProducts.length);

      res.json({
        success: true,
        data: {
          products: lowStockProducts.map(product => product.toJSON()),
          count: lowStockProducts.length
        }
      });

    } catch (error) {
      console.error('💥 Get low stock products error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Update product stock
  // @access  Private
  async updateStock(req, res) {
    try {
      const { productId } = req.params;
      const { quantity, operation = 'add', notes } = req.body;

      console.log('📦 Updating stock for product:', productId, 'Operation:', operation, 'Quantity:', quantity);

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Check ownership
      if (product.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only update your own products.'
        });
      }

      // Validate quantity
      if (!quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid quantity is required'
        });
      }

      const oldStock = product.currentStock;
      await product.updateStock(quantity, operation);
      const newStock = product.currentStock;

      console.log('✅ Stock updated:', product.name, 'Old:', oldStock, 'New:', newStock);

      res.json({
        success: true,
        message: 'Stock updated successfully',
        data: {
          product: product.toJSON(),
          stockChange: {
            operation,
            quantity,
            oldStock,
            newStock,
            notes: notes || ''
          },
          updatedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Update stock error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during stock update'
      });
    }
  }

  // @desc    Search products
  // @access  Private
  async searchProducts(req, res) {
    try {
      const { query, category, status } = req.query;

      console.log('🔍 Searching products:', query);

      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      const searchQuery = {
        snookerHouse: snookerHouse._id
      };

      if (query) {
        searchQuery.$or = [
          { name: new RegExp(query, 'i') },
          { barcode: new RegExp(query, 'i') },
          { description: new RegExp(query, 'i') }
        ];
      }

      if (category) searchQuery.category = category;
      if (status) searchQuery.status = status;

      const products = await Product.find(searchQuery)
        .sort({ name: 1 })
        .limit(50);

      console.log('✅ Search results:', products.length);

      res.json({
        success: true,
        data: {
          products: products.map(product => product.toJSON()),
          count: products.length,
          searchQuery: query
        }
      });

    } catch (error) {
      console.error('💥 Search products error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during search'
      });
    }
  }
}

module.exports = new InventoryController();