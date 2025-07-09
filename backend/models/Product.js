const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  
  barcode: {
    type: String,
    sparse: true, // Allows multiple null values
    trim: true,
    maxlength: [50, 'Barcode cannot exceed 50 characters']
  },
  
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['snacks', 'drinks', 'cigarettes', 'accessories', 'other'],
    default: 'other'
  },
  
  // Snooker house reference
  snookerHouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SnookerHouse',
    required: true,
    index: true
  },
  
  // Owner reference (for quick access)
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Pricing
  costPrice: {
    type: Number,
    required: [true, 'Cost price is required'],
    min: [0, 'Cost price cannot be negative']
  },
  
  sellingPrice: {
    type: Number,
    required: [true, 'Selling price is required'],
    min: [0, 'Selling price cannot be negative']
  },
  
  // Stock Management
  currentStock: {
    type: Number,
    required: [true, 'Current stock is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  
  minStockLevel: {
    type: Number,
    default: 5,
    min: [0, 'Minimum stock level cannot be negative']
  },
  
  unit: {
    type: String,
    enum: ['piece', 'packet', 'bottle', 'can', 'box', 'kg', 'litre'],
    default: 'piece'
  },
  
  // Product Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  },
  
  // Optional fields
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  
  productImage: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v || v.trim() === '') return true;
        return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
      },
      message: 'Please provide a valid image URL'
    },
    default: ''
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
productSchema.index({ snookerHouse: 1, name: 1 });
productSchema.index({ owner: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ barcode: 1 }, { sparse: true });

// Virtual for profit per unit
productSchema.virtual('profitPerUnit').get(function() {
  return this.sellingPrice - this.costPrice;
});

// Virtual for profit percentage
productSchema.virtual('profitPercentage').get(function() {
  if (this.costPrice === 0) return 0;
  return ((this.sellingPrice - this.costPrice) / this.costPrice) * 100;
});

// Virtual for stock value (current stock * cost price)
productSchema.virtual('stockValue').get(function() {
  return this.currentStock * this.costPrice;
});

// Virtual for potential revenue (current stock * selling price)
productSchema.virtual('potentialRevenue').get(function() {
  return this.currentStock * this.sellingPrice;
});

// Virtual for low stock alert
productSchema.virtual('isLowStock').get(function() {
  return this.currentStock <= this.minStockLevel;
});

// Static method to find products by snooker house
productSchema.statics.findBySnookerHouse = function(snookerHouseId, options = {}) {
  const query = { snookerHouse: snookerHouseId };
  
  if (options.category) query.category = options.category;
  if (options.status) query.status = options.status;
  if (options.lowStock) query.$expr = { $lte: ['$currentStock', '$minStockLevel'] };
  
  return this.find(query)
    .sort({ name: 1 })
    .limit(options.limit || 100)
    .skip(options.skip || 0);
};

// Method to update stock
productSchema.methods.updateStock = function(quantity, operation = 'add') {
  if (operation === 'add') {
    this.currentStock += quantity;
  } else if (operation === 'subtract') {
    this.currentStock = Math.max(0, this.currentStock - quantity);
  } else if (operation === 'set') {
    this.currentStock = Math.max(0, quantity);
  }
  
  return this.save();
};

// Transform output
productSchema.methods.toJSON = function() {
  const product = this.toObject();
  
  // Add calculated values
  product.profitPerUnit = this.profitPerUnit;
  product.profitPercentage = Math.round(this.profitPercentage * 100) / 100;
  product.stockValue = this.stockValue;
  product.potentialRevenue = this.potentialRevenue;
  product.isLowStock = this.isLowStock;
  
  return product;
};

module.exports = mongoose.model('Product', productSchema);