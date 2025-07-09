const mongoose = require('mongoose');
const crypto = require('crypto');

const userSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Session identification
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // JWT token hash (for verification)
  tokenHash: {
    type: String,
    required: true,
    index: true
  },
  
  // Device information
  deviceInfo: {
    userAgent: String,
    ip: String,
    platform: String,
    browser: String,
    os: String,
    location: String
  },
  
  // Session status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Session type
  rememberMe: {
    type: Boolean,
    default: false
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  }
}, {
  timestamps: true
});

// Compound indexes for performance
userSessionSchema.index({ user: 1, isActive: 1 });
userSessionSchema.index({ sessionId: 1, isActive: 1 });
userSessionSchema.index({ user: 1, lastActivity: -1 });
userSessionSchema.index({ tokenHash: 1, isActive: 1 });

// Static method to create new session
userSessionSchema.statics.createSession = async function(userId, tokenHash, deviceInfo, expiryHours = 168, rememberMe = false) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
  
  const session = new this({
    user: userId,
    sessionId,
    tokenHash,
    deviceInfo,
    expiresAt,
    rememberMe
  });
  
  await session.save();
  return session;
};

// Static method to find session by token hash
userSessionSchema.statics.findByToken = async function(tokenHash) {
  return this.findOne({
    tokenHash,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).populate('user', 'firstName lastName email isEmailVerified');
};

// Static method to get user sessions
userSessionSchema.statics.getUserSessions = async function(userId, activeOnly = true) {
  const query = { user: userId };
  if (activeOnly) {
    query.isActive = true;
    query.expiresAt = { $gt: new Date() };
  }
  
  return this.find(query)
    .sort({ lastActivity: -1 })
    .select('sessionId deviceInfo createdAt lastActivity isActive rememberMe expiresAt');
};

// Static method to invalidate specific session
userSessionSchema.statics.invalidateSession = async function(sessionId) {
  return this.findOneAndUpdate(
    { sessionId, isActive: true },
    { isActive: false },
    { new: true }
  );
};

// Static method to invalidate user sessions
userSessionSchema.statics.invalidateUserSessions = async function(userId, excludeSessionId = null) {
  const query = { user: userId, isActive: true };
  if (excludeSessionId) {
    query.sessionId = { $ne: excludeSessionId };
  }
  
  return this.updateMany(query, { isActive: false });
};

// Static method to cleanup expired sessions
userSessionSchema.statics.cleanupExpiredSessions = async function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isActive: false, updatedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
    ]
  });
};

// Instance method to update activity
userSessionSchema.methods.updateActivity = async function() {
  this.lastActivity = new Date();
  return this.save();
};

// Instance method to check if expired
userSessionSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Instance method to extend session
userSessionSchema.methods.extendSession = async function(hours = 168) {
  this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.save();
};

// Transform output
userSessionSchema.methods.toJSON = function() {
  const session = this.toObject();
  
  // Add helper properties
  session.isExpired = this.isExpired();
  session.timeLeft = Math.max(0, Math.floor((this.expiresAt - new Date()) / (1000 * 60 * 60))); // hours left
  
  // Format device info for display
  if (session.deviceInfo) {
    session.deviceInfo.displayName = this.getDeviceDisplayName();
  }
  
  return session;
};

// Helper method to get device display name
userSessionSchema.methods.getDeviceDisplayName = function() {
  const { browser, os, platform } = this.deviceInfo;
  let display = '';
  
  if (browser && browser !== 'unknown') {
    display += browser;
  }
  
  if (os && os !== 'unknown') {
    display += display ? ` on ${os}` : os;
  }
  
  if (platform && platform !== 'unknown' && platform !== browser && platform !== os) {
    display += display ? ` (${platform})` : platform;
  }
  
  return display || 'Unknown Device';
};

module.exports = mongoose.model('UserSession', userSessionSchema);