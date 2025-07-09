const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const snookerRoutes = require('./routes/snookerRoutes');
const tableRoutes = require('./routes/tableRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes'); // 📊 NEW: Analytics routes

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.GENERAL_RATE_LIMIT || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.AUTH_RATE_LIMIT || 20,
  message: 'Too many authentication attempts, please try again later.'
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
const connectDB = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nepal-auth');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// Session cleanup job (run every hour)
const UserSession = require('./models/UserSession');
const cleanupExpiredSessions = async () => {
  try {
    const result = await UserSession.cleanupExpiredSessions();
    console.log(`🧹 Cleaned up ${result.deletedCount} expired sessions`);
  } catch (error) {
    console.error('❌ Session cleanup error:', error);
  }
};

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// Test email endpoint (only for development)
if (process.env.NODE_ENV === 'development') {
  app.get('/test-email', async (req, res) => {
    try {
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email parameter required. Usage: /test-email?email=your@email.com'
        });
      }

      console.log('🧪 Testing email service...');
      console.log('Target email:', email);

      const emailService = require('./services/emailService');
      
      // Test connection first
      console.log('📧 Testing email connection...');
      const connectionTest = await emailService.testConnection();
      console.log('Connection test result:', connectionTest);

      if (!connectionTest.success) {
        return res.status(500).json({
          success: false,
          message: 'Email service connection failed',
          error: connectionTest.error,
          configuration: emailService.getConfiguration()
        });
      }

      // Send test OTP
      console.log('📮 Sending test OTP...');
      const testOTP = '123456';
      const result = await emailService.sendOTP(email, testOTP, 'signup');
      
      console.log('📧 Email send result:', result);

      res.json({
        success: result.success,
        message: result.success ? 'Test email sent successfully! Check your inbox.' : 'Failed to send test email',
        result: result,
        configuration: emailService.getConfiguration(),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Test email error:', error);
      res.status(500).json({
        success: false,
        message: 'Test email failed',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Email configuration check endpoint
  app.get('/check-email-config', (req, res) => {
    const emailService = require('./services/emailService');
    
    res.json({
      success: true,
      message: 'Email configuration status',
      configuration: emailService.getConfiguration(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        EMAIL_USER: process.env.EMAIL_USER ? 'Set' : 'Missing',
        EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD ? 'Set' : 'Missing'
      },
      timestamp: new Date().toISOString()
    });
  });

  // Session cleanup endpoint
  app.post('/cleanup-sessions', async (req, res) => {
    try {
      await cleanupExpiredSessions();
      res.json({
        success: true,
        message: 'Session cleanup completed'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Session cleanup failed',
        error: error.message
      });
    }
  });

  console.log('📧 Development endpoints available:');
  console.log('   - Test email: /test-email?email=your@email.com');
  console.log('   - Check config: /check-email-config');
  console.log('   - Cleanup sessions: POST /cleanup-sessions');
}

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/snooker', snookerRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/analytics', analyticsRoutes); // 📊 NEW: Analytics routes

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check MongoDB connection
    const mongoStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    
    // Check session cleanup status
    const sessionCount = await UserSession.countDocuments({ isActive: true });
    const expiredSessionCount = await UserSession.countDocuments({ 
      isActive: true, 
      expiresAt: { $lt: new Date() } 
    });

    res.status(200).json({ 
      status: 'OK', 
      message: 'Nepal Auth API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      mongodb: mongoStatus,
      emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD),
      sessions: {
        active: sessionCount,
        expired: expiredSessionCount,
        needsCleanup: expiredSessionCount > 0
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Health check failed',
      error: error.message
    });
  }
});

// API info endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🇳🇵 Nepal Snooker Management API',
    version: '3.2.0', // ← Updated version for analytics
    status: 'Running',
    architecture: 'MVC (Model-View-Controller)',
    features: [
      '✅ User Authentication with Sessions',
      '✅ Session Management & Tracking',
      '✅ Device Management',
      '✅ Snooker House Management',
      '✅ Table Management',
      '✅ Game Session Tracking',
      '✅ Email Notifications',
      '✅ Structured Controllers & Routes',
      '✅ Consolidated Validation',
      '✅ Enhanced Security',
      '🔧 Fixed: ObjectId Authentication Bug',
      '📦 Inventory Management System',
      '📊 NEW: Business Analytics Dashboard' // ← Added analytics feature
    ],
    endpoints: {
      health: '/health',
      auth: '/api/auth/* (Unified Authentication)',
      user: '/api/user/* (User Management)',
      snooker: '/api/snooker/* (Snooker House)',
      tables: '/api/tables/* (Table Management)',
      sessions: '/api/sessions/* (Game Sessions)',
      inventory: '/api/inventory/* (Inventory & Sales)',
      analytics: '/api/analytics/* (Business Analytics)', // ← NEW endpoint
      ...(process.env.NODE_ENV === 'development' && {
        testEmail: '/test-email?email=your@email.com',
        checkConfig: '/check-email-config',
        cleanupSessions: 'POST /cleanup-sessions'
      })
    },
    analytics: {
      description: 'Comprehensive business analytics and insights',
      features: [
        '📊 Business Dashboard with Key Metrics',
        '💰 Financial Reports & Revenue Analysis',
        '👥 Customer Analytics & Segmentation',
        '📈 Trend Analysis & Forecasting',
        '🎯 Performance Insights & Recommendations',
        '📋 Detailed Financial Statements',
        '🔍 Advanced Data Filtering',
        '📱 Real-time Dashboard Updates'
      ],
      endpoints: {
        dashboard: '/api/analytics/dashboard',
        financialReport: '/api/analytics/financial-report',
        customerAnalytics: '/api/analytics/customer-analytics'
      },
      queryParameters: {
        period: ['today', 'week', 'month', 'year', 'custom'],
        format: ['json', 'csv', 'pdf'],
        segment: ['all', 'vip', 'premium', 'regular', 'frequent', 'new']
      }
    },
    inventory: {
      description: 'Complete inventory management system',
      features: [
        '📦 Product Management (CRUD)',
        '💰 Sales Recording with Profit Tracking',
        '📊 Inventory Statistics & Analytics',
        '⚠️ Low Stock Alerts',
        '🔍 Product Search & Filtering',
        '📈 Revenue & Profit Reports'
      ],
      categories: ['snacks', 'drinks', 'cigarettes', 'accessories', 'other'],
      paymentMethods: ['cash', 'card', 'mobile', 'credit'],
      units: ['piece', 'packet', 'bottle', 'can', 'box', 'kg', 'litre']
    },
    fixes: {
      v301: {
        description: 'Fixed 403 authentication bug',
        changes: [
          'Fixed ObjectId vs String comparison in auth middleware',
          'Increased auth rate limit from 5 to 20 requests',
          'Ensured consistent string conversion for user IDs'
        ]
      },
      v310: {
        description: 'Added comprehensive inventory management',
        changes: [
          'Added Product model with profit calculations',
          'Added Sale model with detailed tracking',
          'Added inventory controller with full CRUD',
          'Added sales recording with stock updates',
          'Added inventory statistics and analytics',
          'Added low stock alerts and management'
        ]
      },
      v320: {
        description: 'Added business analytics dashboard',
        changes: [
          'Added comprehensive business analytics controller',
          'Added financial reporting with profit/loss analysis',
          'Added customer analytics and segmentation',
          'Added trend analysis and insights generation',
          'Added performance metrics and KPI tracking',
          'Added query validation for analytics endpoints'
        ]
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Server Error:', err);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  // Session error
  if (err.message && err.message.includes('session')) {
    return res.status(401).json({
      success: false,
      message: 'Session error',
      code: 'SESSION_ERROR'
    });
  }

  // Default error
  res.status(err.status || 500).json({ 
    success: false, 
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: {
      auth: '/api/auth/*',
      user: '/api/user/*',
      snooker: '/api/snooker/*',
      tables: '/api/tables/*',
      sessions: '/api/sessions/*',
      inventory: '/api/inventory/*',
      analytics: '/api/analytics/*' // ← NEW endpoint
    },
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('🔌 MongoDB connection closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('🔌 MongoDB connection closed.');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log('\n🚀 ========================================');
  console.log(`🇳🇵 Nepal Snooker Management API v3.2.0`); // ← Updated version
  console.log('🚀 ========================================');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📧 Email configured: ${!!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) ? '✅' : '❌'}`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`\n🏗️  Architecture: MVC (Model-View-Controller)`);
  console.log(`\n📋 API Endpoints:`);
  console.log(`   🔐 Auth: http://localhost:${PORT}/api/auth/*`);
  console.log(`   👤 User: http://localhost:${PORT}/api/user/*`);
  console.log(`   🎱 Snooker: http://localhost:${PORT}/api/snooker/*`);
  console.log(`   🎯 Tables: http://localhost:${PORT}/api/tables/*`);
  console.log(`   ⏱️  Sessions: http://localhost:${PORT}/api/sessions/*`);
  console.log(`   📦 Inventory: http://localhost:${PORT}/api/inventory/*`);
  console.log(`   📊 Analytics: http://localhost:${PORT}/api/analytics/*`); // ← NEW endpoint
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n🧪 Development Tools:`);
    console.log(`   📧 Test email: http://localhost:${PORT}/test-email?email=your@email.com`);
    console.log(`   ⚙️  Check config: http://localhost:${PORT}/check-email-config`);
    console.log(`   🧹 Cleanup sessions: POST http://localhost:${PORT}/cleanup-sessions`);
  }
  
  console.log(`\n📊 NEW in v3.2.0:`);
  console.log(`   ✅ Comprehensive Business Analytics Dashboard`);
  console.log(`   ✅ Financial Reports & Revenue Analysis`);
  console.log(`   ✅ Customer Analytics & Segmentation`);
  console.log(`   ✅ Performance Insights & Recommendations`);
  console.log(`   ✅ Trend Analysis & Forecasting`);
  console.log(`   ✅ Advanced Data Filtering & Export`);
  
  console.log(`\n📦 Inventory Management v3.1.0:`);
  console.log(`   ✅ Complete Product & Sales Management`);
  console.log(`   ✅ Profit Tracking & Low Stock Alerts`);
  console.log(`   ✅ Revenue Analytics & Reports`);
  
  console.log(`\n🔧 Fixed in v3.0.1:`);
  console.log(`   ✅ ObjectId Authentication Bug Fixed`);
  console.log(`   ✅ Increased Auth Rate Limit (5→20)`);
  console.log(`   ✅ Consistent User ID String Conversion`);
  console.log('🚀 ========================================\n');
  
  // Run initial session cleanup
  setTimeout(cleanupExpiredSessions, 5000);
});