const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true // Store name for record keeping
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  costPrice: {
    type: Number,
    required: true,
    min: [0, 'Cost price cannot be negative']
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: [0, 'Selling price cannot be negative']
  },
  totalCost: {
    type: Number,
    required: true
  },
  totalRevenue: {
    type: Number,
    required: true
  },
  profit: {
    type: Number,
    required: true
  }
});

const saleSchema = new mongoose.Schema({
  // Basic Information
  saleNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // References
  snookerHouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SnookerHouse',
    required: true,
    index: true
  },
  
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Optional session reference (if sold during a game session)
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    default: null
  },
  
  // Sale Items
  items: [saleItemSchema],
  
  // Sale Summary
  totalItems: {
    type: Number,
    required: true,
    min: [1, 'Must have at least one item']
  },
  
  totalCost: {
    type: Number,
    required: true,
    min: [0, 'Total cost cannot be negative']
  },
  
  totalRevenue: {
    type: Number,
    required: true,
    min: [0, 'Total revenue cannot be negative']
  },
  
  totalProfit: {
    type: Number,
    required: true
  },
  
  // Payment Information
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'mobile', 'credit'],
    default: 'cash'
  },
  
  // Customer Information (optional)
  customerName: {
    type: String,
    trim: true,
    maxlength: [100, 'Customer name cannot exceed 100 characters']
  },
  
  customerPhone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  
  // Additional Information
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    default: ''
  },
  
  // Tracking
  createdBySession: {
    type: String, // User session ID
    default: null
  },
  
  // Timestamps
  saleDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
saleSchema.index({ snookerHouse: 1, saleDate: -1 });
saleSchema.index({ owner: 1, saleDate: -1 });
saleSchema.index({ saleNumber: 1 });
saleSchema.index({ session: 1 });

// Static method to generate sale number
saleSchema.statics.generateSaleNumber = async function(snookerHouseId) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  
  const count = await this.countDocuments({
    snookerHouse: snookerHouseId,
    createdAt: {
      $gte: new Date(today.setHours(0, 0, 0, 0)),
      $lt: new Date(today.setHours(23, 59, 59, 999))
    }
  });
  
  const saleNumber = `SL${dateStr}${String(count + 1).padStart(3, '0')}`;
  return saleNumber;
};

// Static method to get sales by snooker house
saleSchema.statics.getSalesBySnookerHouse = function(snookerHouseId, options = {}) {
  const query = { snookerHouse: snookerHouseId };
  
  if (options.dateFrom || options.dateTo) {
    query.saleDate = {};
    if (options.dateFrom) query.saleDate.$gte = new Date(options.dateFrom);
    if (options.dateTo) query.saleDate.$lte = new Date(options.dateTo);
  }
  
  if (options.paymentMethod) query.paymentMethod = options.paymentMethod;
  
  return this.find(query)
    .populate('items.product', 'name category')
    .sort({ saleDate: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

// Method to calculate totals (for validation)
saleSchema.methods.calculateTotals = function() {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.totalCost = this.items.reduce((sum, item) => sum + item.totalCost, 0);
  this.totalRevenue = this.items.reduce((sum, item) => sum + item.totalRevenue, 0);
  this.totalProfit = this.totalRevenue - this.totalCost;
};

module.exports = mongoose.model('Sale', saleSchema);