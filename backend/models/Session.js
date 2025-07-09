const mongoose = require('mongoose');

// Schema for items added to session
const sessionItemSchema = new mongoose.Schema({
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
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

// 🆕 NEW: Payment tracking schema
const paymentSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['esewa', 'online_banking', 'cash'],
    required: true
  },
  methodLabel: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Payment amount cannot be negative']
  },
  paidAt: {
    type: Date,
    default: Date.now
  },
  transactionId: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [200, 'Payment notes cannot exceed 200 characters']
  }
});

const sessionSchema = new mongoose.Schema({
  // Basic Information
  table: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    required: true,
    index: true
  },
  
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
  
  // Session Details
  customerName: {
    type: String,
    required: false,
    trim: true,
    maxlength: [100, 'Customer name cannot exceed 100 characters'],
    default: 'Guest'
  },
  
  customerPhone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  
  // Session Status
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active'
  },
  
  // Timing
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  endTime: {
    type: Date,
    default: null
  },
  
  pausedAt: {
    type: Date,
    default: null
  },
  
  totalPausedTime: {
    type: Number, // in milliseconds
    default: 0
  },
  
  // Game Tracking (for frame_kitti pricing)
  frames: {
    type: Number,
    default: 0,
    min: [0, 'Frames cannot be negative']
  },
  
  kittis: {
    type: Number,
    default: 0,
    min: [0, 'Kittis cannot be negative']
  },
  
  // Items purchased during session
  items: [sessionItemSchema],
  
  // Item totals
  totalItems: {
    type: Number,
    default: 0
  },
  
  totalItemsCost: {
    type: Number,
    default: 0
  },
  
  totalItemsRevenue: {
    type: Number,
    default: 0
  },
  
  totalItemsProfit: {
    type: Number,
    default: 0
  },
  
  // Pricing Information (snapshot from table at session start)
  pricingMethod: {
    type: String,
    enum: ['per_minute', 'frame_kitti'],
    required: true
  },
  
  minuteRate: {
    type: Number,
    min: [0, 'Minute rate cannot be negative']
  },
  
  // Keep hourlyRate for backward compatibility
  hourlyRate: {
    type: Number,
    min: [0, 'Hourly rate cannot be negative']
  },
  
  frameRate: {
    type: Number,
    min: [0, 'Frame rate cannot be negative']
  },
  
  kittiRate: {
    type: Number,
    min: [0, 'Kitti rate cannot be negative']
  },
  
  // Cost Calculation
  gameCost: {
    type: Number,
    default: 0,
    min: [0, 'Game cost cannot be negative']
  },
  
  totalCost: {
    type: Number,
    default: 0,
    min: [0, 'Total cost cannot be negative']
  },
  
  // 🆕 NEW: Payment Information
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'credit'],
    default: 'pending'
  },
  
  paymentMethod: {
    type: String,
    enum: ['esewa', 'online_banking', 'cash', null],
    default: null
  },
  
  paymentMethodLabel: {
    type: String,
    default: null
  },
  
  // For multiple payments (if needed in future)
  payments: [paymentSchema],
  
  totalPaidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  
  remainingAmount: {
    type: Number,
    default: 0
  },
  
  paymentNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Payment notes cannot exceed 500 characters']
  },
  
  paymentCompletedAt: {
    type: Date,
    default: null
  },
  
  // Tracking
  createdBySession: {
    type: String, // User session ID
    default: null
  },
  
  lastModifiedBySession: {
    type: String,
    default: null
  },
  
  lastModifiedAt: {
    type: Date,
    default: Date.now
  },
  
  // Notes
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
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

// Indexes for better query performance
sessionSchema.index({ table: 1, status: 1 });
sessionSchema.index({ snookerHouse: 1, createdAt: -1 });
sessionSchema.index({ owner: 1, createdAt: -1 });
sessionSchema.index({ status: 1, createdAt: -1 });
sessionSchema.index({ paymentStatus: 1, createdAt: -1 }); // 🆕 NEW: Payment status index

// Method to calculate session duration in minutes
sessionSchema.methods.getDurationInMinutes = function() {
  const now = this.status === 'active' ? Date.now() : (this.endTime?.getTime() || Date.now());
  const effectiveStartTime = this.startTime.getTime();
  const totalPaused = this.totalPausedTime || 0;
  
  // If currently paused, add current pause duration
  let currentPauseDuration = 0;
  if (this.status === 'paused' && this.pausedAt) {
    currentPauseDuration = Date.now() - this.pausedAt.getTime();
  }
  
  return Math.floor((now - effectiveStartTime - totalPaused - currentPauseDuration) / (1000 * 60));
};

// Method to calculate game cost only
sessionSchema.methods.calculateGameCost = function() {
  if (this.pricingMethod === 'per_minute') {
    const minutes = this.getDurationInMinutes();
    // Use minuteRate if available, fallback to hourlyRate/60 for backward compatibility
    if (this.minuteRate !== undefined) {
      return this.minuteRate * minutes; // Direct per-minute calculation
    } else {
      return (this.hourlyRate / 60) * minutes; // Backward compatibility
    }
  } else if (this.pricingMethod === 'frame_kitti') {
    return (this.frames * this.frameRate) + (this.kittis * this.kittiRate);
  }
  return 0;
};

// Method to calculate current total cost (game + items)
sessionSchema.methods.calculateCurrentCost = function() {
  const gameCost = this.calculateGameCost();
  return gameCost + this.totalItemsRevenue;
};

// Method to calculate items totals
sessionSchema.methods.calculateItemsTotals = function() {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.totalItemsCost = this.items.reduce((sum, item) => sum + item.totalCost, 0);
  this.totalItemsRevenue = this.items.reduce((sum, item) => sum + item.totalRevenue, 0);
  this.totalItemsProfit = this.totalItemsRevenue - this.totalItemsCost;
};

// Method to update total cost
sessionSchema.methods.updateTotalCost = function() {
  this.calculateItemsTotals();
  this.gameCost = this.calculateGameCost();
  this.totalCost = this.gameCost + this.totalItemsRevenue;
  this.updatePaymentAmounts(); // 🆕 NEW: Update payment calculations
  return this.save();
};

// 🆕 NEW: Method to update payment amounts
sessionSchema.methods.updatePaymentAmounts = function() {
  this.totalPaidAmount = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
  this.remainingAmount = Math.max(0, this.totalCost - this.totalPaidAmount);
  
  // Update payment status based on amounts
  if (this.totalPaidAmount === 0) {
    this.paymentStatus = 'pending';
  } else if (this.totalPaidAmount >= this.totalCost) {
    this.paymentStatus = 'paid';
    if (!this.paymentCompletedAt) {
      this.paymentCompletedAt = new Date();
    }
  } else {
    this.paymentStatus = 'credit';
  }
};

// 🆕 NEW: Method to record payment
sessionSchema.methods.recordPayment = function(paymentData) {
  const { method, amount, transactionId, notes } = paymentData;
  
  // Validate payment method
  const validMethods = {
    'esewa': 'eSewa',
    'online_banking': 'Online Banking',
    'cash': 'Cash'
  };
  
  if (!validMethods[method]) {
    throw new Error('Invalid payment method');
  }
  
  // Add payment record
  this.payments.push({
    method,
    methodLabel: validMethods[method],
    amount,
    transactionId: transactionId || '',
    notes: notes || '',
    paidAt: new Date()
  });
  
  // Update primary payment method if this is the first/main payment
  if (!this.paymentMethod || this.payments.length === 1) {
    this.paymentMethod = method;
    this.paymentMethodLabel = validMethods[method];
  }
  
  // Update payment amounts and status
  this.updatePaymentAmounts();
  
  return this.save();
};

// 🆕 NEW: Method to mark session as paid
sessionSchema.methods.markAsPaid = function(paymentData) {
  const { method, transactionId, notes } = paymentData;
  
  // Record full payment
  return this.recordPayment({
    method,
    amount: this.totalCost - this.totalPaidAmount,
    transactionId,
    notes
  });
};

// 🆕 NEW: Method to mark session as credit
sessionSchema.methods.markAsCredit = function(notes) {
  this.paymentStatus = 'credit';
  this.paymentNotes = notes || 'Payment credited - to be collected later';
  this.lastModifiedAt = new Date();
  return this.save();
};

// 🆕 NEW: Method to get payment summary
sessionSchema.methods.getPaymentSummary = function() {
  return {
    status: this.paymentStatus,
    totalCost: this.totalCost,
    totalPaid: this.totalPaidAmount,
    remaining: this.remainingAmount,
    method: this.paymentMethodLabel,
    isFullyPaid: this.paymentStatus === 'paid',
    isCredited: this.paymentStatus === 'credit',
    isPending: this.paymentStatus === 'pending',
    paymentsCount: this.payments.length,
    lastPaymentAt: this.payments.length > 0 ? this.payments[this.payments.length - 1].paidAt : null
  };
};

// Method to add item to session
sessionSchema.methods.addItem = function(itemData) {
  const { product, productName, quantity, costPrice, sellingPrice } = itemData;
  
  const totalCost = costPrice * quantity;
  const totalRevenue = sellingPrice * quantity;
  const profit = totalRevenue - totalCost;
  
  this.items.push({
    product,
    productName,
    quantity,
    costPrice,
    sellingPrice,
    totalCost,
    totalRevenue,
    profit,
    addedAt: new Date()
  });
  
  this.calculateItemsTotals();
  this.totalCost = this.calculateGameCost() + this.totalItemsRevenue;
  this.updatePaymentAmounts(); // 🆕 NEW: Update payment amounts when items change
  
  return this.save();
};

// Method to remove item from session
sessionSchema.methods.removeItem = function(itemId) {
  this.items = this.items.filter(item => item._id.toString() !== itemId);
  this.calculateItemsTotals();
  this.totalCost = this.calculateGameCost() + this.totalItemsRevenue;
  this.updatePaymentAmounts(); // 🆕 NEW: Update payment amounts when items change
  return this.save();
};

// Static method to get active session for a table
sessionSchema.statics.getActiveSession = function(tableId) {
  return this.findOne({ 
    table: tableId, 
    status: { $in: ['active', 'paused'] }
  })
  .populate('table', 'name tableNumber')
  .populate('items.product', 'name category unit');
};

// Static method to get sessions by snooker house
sessionSchema.statics.getBySnookerHouse = function(snookerHouseId, options = {}) {
  const query = { snookerHouse: snookerHouseId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.paymentStatus) { // 🆕 NEW: Filter by payment status
    query.paymentStatus = options.paymentStatus;
  }
  
  if (options.dateFrom || options.dateTo) {
    query.createdAt = {};
    if (options.dateFrom) query.createdAt.$gte = new Date(options.dateFrom);
    if (options.dateTo) query.createdAt.$lte = new Date(options.dateTo);
  }
  
  if (options.tableId) {
    query.table = options.tableId;
  }
  
  return this.find(query)
    .populate('table', 'name tableNumber')
    .populate('items.product', 'name category unit')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

// 🆕 NEW: Static method to get payment statistics
sessionSchema.statics.getPaymentStats = function(snookerHouseId, dateFrom, dateTo) {
  const matchQuery = { 
    snookerHouse: snookerHouseId,
    status: 'completed'
  };
  
  if (dateFrom || dateTo) {
    matchQuery.endTime = {};
    if (dateFrom) matchQuery.endTime.$gte = new Date(dateFrom);
    if (dateTo) matchQuery.endTime.$lte = new Date(dateTo);
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$paymentStatus',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalCost' },
        totalPaid: { $sum: '$totalPaidAmount' }
      }
    }
  ]);
};

// Transform output
sessionSchema.methods.toJSON = function() {
  const session = this.toObject();
  
  // Add calculated values for easier frontend consumption
  session.currentGameCost = this.calculateGameCost();
  session.currentTotalCost = this.calculateCurrentCost();
  session.durationMinutes = this.getDurationInMinutes();
  
  // 🆕 NEW: Add payment summary
  session.paymentSummary = this.getPaymentSummary();
  
  // Add summary
  session.summary = {
    gameCost: session.currentGameCost,
    itemsRevenue: this.totalItemsRevenue,
    itemsProfit: this.totalItemsProfit,
    totalCost: session.currentTotalCost,
    duration: session.durationMinutes,
    totalItems: this.totalItems,
    // 🆕 NEW: Payment summary
    paymentStatus: this.paymentStatus,
    paymentMethod: this.paymentMethodLabel,
    totalPaid: this.totalPaidAmount,
    remainingAmount: this.remainingAmount
  };
  
  return session;
};

module.exports = mongoose.model('Session', sessionSchema);