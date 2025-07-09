const mongoose = require('mongoose');

const snookerHouseSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Snooker house name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  // Owner reference
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Profile picture for the snooker house (optional)
  profilePicture: {
    type: String,
    required: false,
    default: '',
    validate: {
      validator: function(v) {
        // If empty, it's valid (optional field)
        if (!v || v.trim() === '') return true;
        // If provided, must be valid image URL
        return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
      },
      message: 'Please provide a valid image URL'
    }
  },
  
  // Address
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    maxlength: [200, 'Address cannot exceed 200 characters']
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

// Index for better query performance
snookerHouseSchema.index({ owner: 1 });
snookerHouseSchema.index({ createdAt: -1 });

// Static method to find by owner
snookerHouseSchema.statics.findByOwner = function(ownerId) {
  return this.find({ owner: ownerId }).populate('owner', 'firstName lastName email');
};

// Transform output
snookerHouseSchema.methods.toJSON = function() {
  const house = this.toObject();
  return house;
};

module.exports = mongoose.model('SnookerHouse', snookerHouseSchema);