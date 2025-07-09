const mongoose = require('mongoose');
const crypto = require('crypto');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['signup', 'login', 'password_reset', 'email_verification'],
    required: true
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient lookups
otpSchema.index({ email: 1, purpose: 1 });
otpSchema.index({ otp: 1 });

// Static method to generate OTP
otpSchema.statics.generateOTP = function() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

// Static method to create new OTP
otpSchema.statics.createOTP = async function(email, purpose, expiryMinutes = 10) {
  // Delete any existing OTP for this email and purpose
  await this.deleteMany({ email: email.toLowerCase(), purpose });
  
  const otp = this.generateOTP();
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  
  const otpDoc = new this({
    email: email.toLowerCase(),
    otp,
    purpose,
    expiresAt
  });
  
  await otpDoc.save();
  return otpDoc;
};

// Static method to verify OTP
otpSchema.statics.verifyOTP = async function(email, otp, purpose) {
  const otpDoc = await this.findOne({
    email: email.toLowerCase(),
    otp,
    purpose,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });
  
  if (!otpDoc) {
    return { success: false, message: 'Invalid or expired OTP' };
  }
  
  // Mark as used
  otpDoc.isUsed = true;
  await otpDoc.save();
  
  return { success: true, message: 'OTP verified successfully' };
};

// Method to increment attempts
otpSchema.methods.incrementAttempts = async function() {
  this.attempts += 1;
  if (this.attempts >= 3) {
    this.isUsed = true; // Block further attempts
  }
  await this.save();
  return this.attempts;
};

// Static method to check if OTP can be sent (rate limiting)
otpSchema.statics.canSendOTP = async function(email, purpose) {
  const recentOTP = await this.findOne({
    email: email.toLowerCase(),
    purpose,
    createdAt: { $gt: new Date(Date.now() - 2 * 60 * 1000) } // 2 minutes
  });
  
  if (recentOTP) {
    return {
      canSend: false,
      waitTime: Math.ceil((2 * 60 * 1000 - (Date.now() - recentOTP.createdAt)) / 1000)
    };
  }
  
  return { canSend: true };
};

// Static method to get OTP info without revealing the actual OTP
otpSchema.methods.getPublicInfo = function() {
  return {
    email: this.email,
    purpose: this.purpose,
    attempts: this.attempts,
    expiresAt: this.expiresAt,
    isUsed: this.isUsed,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('OTP', otpSchema);