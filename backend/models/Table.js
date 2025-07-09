const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  // Basic Information
  tableNumber: {
    type: Number,
    required: [true, 'Table number is required'],
    min: [1, 'Table number must be at least 1']
  },
  
  name: {
    type: String,
    required: [true, 'Table name is required'],
    trim: true,
    maxlength: [50, 'Table name cannot exceed 50 characters']
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
  
  // Table status
  status: {
    type: String,
    enum: ['active', 'maintenance', 'inactive'],
    default: 'active'
  },
  
  // Pricing method and rates
  pricingMethod: {
    type: String,
    enum: ['per_minute', 'frame_kitti'],
    required: [true, 'Pricing method is required'],
    default: 'per_minute'
  },
  
  // For per_minute pricing
  hourlyRate: {
    type: Number,
    required: function() {
      return this.pricingMethod === 'per_minute';
    },
    min: [0, 'Hourly rate cannot be negative'],
    validate: {
      validator: function(value) {
        if (this.pricingMethod === 'per_minute') {
          return value != null && value >= 0;
        }
        return true;
      },
      message: 'Hourly rate is required for per-minute pricing'
    }
  },
  
  // For frame_kitti pricing
  frameRate: {
    type: Number,
    required: function() {
      return this.pricingMethod === 'frame_kitti';
    },
    min: [0, 'Frame rate cannot be negative'],
    validate: {
      validator: function(value) {
        if (this.pricingMethod === 'frame_kitti') {
          return value != null && value >= 0;
        }
        return true;
      },
      message: 'Frame rate is required for frame & kitti pricing'
    }
  },
  
  kittiRate: {
    type: Number,
    required: function() {
      return this.pricingMethod === 'frame_kitti';
    },
    min: [0, 'Kitti rate cannot be negative'],
    validate: {
      validator: function(value) {
        if (this.pricingMethod === 'frame_kitti') {
          return value != null && value >= 0;
        }
        return true;
      },
      message: 'Kitti rate is required for frame & kitti pricing'
    }
  },
  
  // Description (optional)
  description: {
    type: String,
    maxlength: [200, 'Description cannot exceed 200 characters'],
    default: ''
  },
  
  // Current booking status
  isOccupied: {
    type: Boolean,
    default: false
  },
  
  currentBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
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

// Compound index to ensure unique table numbers within a snooker house
tableSchema.index({ snookerHouse: 1, tableNumber: 1 }, { unique: true });

// Index for better query performance
tableSchema.index({ owner: 1 });
tableSchema.index({ status: 1 });
tableSchema.index({ isOccupied: 1 });
tableSchema.index({ pricingMethod: 1 });

// Static method to find tables by snooker house
tableSchema.statics.findBySnookerHouse = function(snookerHouseId) {
  return this.find({ snookerHouse: snookerHouseId })
    .populate('snookerHouse', 'name address')
    .sort({ tableNumber: 1 });
};

// Static method to find tables by owner
tableSchema.statics.findByOwner = function(ownerId) {
  return this.find({ owner: ownerId })
    .populate('snookerHouse', 'name address')
    .sort({ tableNumber: 1 });
};

// Method to check if table is available
tableSchema.methods.isAvailable = function() {
  return this.status === 'active' && !this.isOccupied;
};

// Method to get pricing info
tableSchema.methods.getPricingInfo = function() {
  if (this.pricingMethod === 'per_minute') {
    return {
      method: 'per_minute',
      hourlyRate: this.hourlyRate,
      displayText: `NPR ${this.hourlyRate}/hour`
    };
  } else {
    return {
      method: 'frame_kitti',
      frameRate: this.frameRate,
      kittiRate: this.kittiRate,
      displayText: `Frame: NPR ${this.frameRate} | Kitti: NPR ${this.kittiRate}`
    };
  }
};

// Method to calculate cost based on pricing method
tableSchema.methods.calculateCost = function(params) {
  if (this.pricingMethod === 'per_minute') {
    const { minutes } = params;
    if (!minutes) throw new Error('Minutes required for per-minute pricing');
    return (this.hourlyRate / 60) * minutes;
  } else {
    const { frames = 0, kittis = 0 } = params;
    return (frames * this.frameRate) + (kittis * this.kittiRate);
  }
};

// Method to get next available table number for a snooker house
tableSchema.statics.getNextTableNumber = async function(snookerHouseId) {
  const tables = await this.find({ snookerHouse: snookerHouseId })
    .sort({ tableNumber: 1 })
    .select('tableNumber');
  
  if (tables.length === 0) {
    return 1;
  }
  
  // Find the first gap in table numbers or return next sequential number
  for (let i = 0; i < tables.length; i++) {
    if (tables[i].tableNumber !== i + 1) {
      return i + 1;
    }
  }
  
  return tables.length + 1;
};

// Transform output
tableSchema.methods.toJSON = function() {
  const table = this.toObject();
  
  // Add pricing info for easier frontend consumption
  table.pricingInfo = this.getPricingInfo();
  
  return table;
};

module.exports = mongoose.model('Table', tableSchema);