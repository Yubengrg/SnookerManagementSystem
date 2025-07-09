const Session = require('../models/Session');
const Table = require('../models/Table');
const SnookerHouse = require('../models/SnookerHouse');
const Product = require('../models/Product');

class SessionController {
  // @desc    Start a new session
  // @access  Private (table owner only)
  async startSession(req, res) {
    try {
      const { tableId, customerName, customerPhone, notes } = req.body;

      console.log('🎯 Starting session request:', {
        tableId,
        customerName: customerName || 'Not provided (will use Guest)',
        userId: req.user?.id,
        userEmail: req.user?.email
      });

      // Find and validate table
      const table = await Table.findById(tableId).populate('snookerHouse');
      if (!table) {
        console.log('❌ Table not found:', tableId);
        return res.status(404).json({
          success: false,
          message: 'Table not found'
        });
      }

      console.log('🎯 Table ownership check for start:', {
        tableId: table._id,
        tableName: table.name,
        tableOwner: table.owner.toString(),
        currentUser: req.user.id,
        match: table.owner.toString() === req.user.id
      });

      // Check ownership
      if (table.owner.toString() !== req.user.id) {
        console.log('❌ Access denied - ownership mismatch for start session');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only manage your own tables.',
          debug: process.env.NODE_ENV === 'development' ? {
            tableOwner: table.owner.toString(),
            currentUser: req.user.id,
            tableName: table.name
          } : undefined
        });
      }

      // Check if table is available
      if (table.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Table is not available for booking'
        });
      }

      if (table.isOccupied) {
        return res.status(400).json({
          success: false,
          message: 'Table is already occupied'
        });
      }

      // Check for existing active session
      const existingSession = await Session.getActiveSession(tableId);
      if (existingSession) {
        return res.status(400).json({
          success: false,
          message: 'Table already has an active session'
        });
      }

      // Handle optional customer name with proper default logic
      const finalCustomerName = customerName && customerName.trim() 
        ? customerName.trim() 
        : 'Guest';

      console.log('🔧 Customer name processing:', {
        provided: customerName,
        trimmed: customerName?.trim(),
        final: finalCustomerName
      });

      // Create session with pricing snapshot
      const sessionData = {
        table: tableId,
        snookerHouse: table.snookerHouse._id,
        owner: req.user.id,
        customerName: finalCustomerName,
        customerPhone: customerPhone?.trim() || '',
        notes: notes?.trim() || '',
        pricingMethod: table.pricingMethod,
        startTime: new Date(),
        createdBySession: req.session?.id,
        items: [],
        totalItems: 0,
        totalItemsCost: 0,
        totalItemsRevenue: 0,
        totalItemsProfit: 0,
        // 🆕 NEW: Initialize payment fields
        paymentStatus: 'pending',
        paymentMethod: null,
        paymentMethodLabel: null,
        payments: [],
        totalPaidAmount: 0,
        remainingAmount: 0,
        paymentNotes: '',
        paymentCompletedAt: null
      };

      // Add pricing rates based on method
      if (table.pricingMethod === 'per_minute') {
        sessionData.minuteRate = table.hourlyRate;
      } else if (table.pricingMethod === 'frame_kitti') {
        sessionData.frameRate = table.frameRate;
        sessionData.kittiRate = table.kittiRate;
        sessionData.frames = 0;
        sessionData.kittis = 0;
      }

      const session = new Session(sessionData);
      await session.save();

      // Mark table as occupied
      table.isOccupied = true;
      table.currentBooking = session._id;
      await table.save();

      // Populate for response
      await session.populate('table', 'name tableNumber');

      console.log('✅ Session started successfully:', {
        sessionId: session._id,
        customer: session.customerName,
        customerNameSource: customerName ? 'provided' : 'default',
        tableId: tableId
      });

      res.status(201).json({
        success: true,
        message: 'Session started successfully!',
        data: { 
          session,
          startedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Start session error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during session start',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // @desc    Get active session for a table
  // @access  Private (table owner only)
  async getActiveSession(req, res) {
    try {
      const { tableId } = req.params;

      console.log('🎯 Active session request:', {
        tableId,
        userId: req.user?.id,
        userEmail: req.user?.email,
        sessionId: req.session?.id
      });

      // Validate tableId format first
      if (!tableId || !tableId.match(/^[0-9a-fA-F]{24}$/)) {
        console.log('❌ Invalid table ID format:', tableId);
        return res.status(400).json({
          success: false,
          message: 'Invalid table ID format'
        });
      }

      // Verify table exists and get ownership info
      const table = await Table.findById(tableId);
      if (!table) {
        console.log('❌ Table not found:', tableId);
        return res.status(404).json({
          success: false,
          message: 'Table not found'
        });
      }

      console.log('🎯 Table ownership check:', {
        tableId: table._id,
        tableName: table.name,
        tableOwner: table.owner.toString(),
        currentUser: req.user.id,
        match: table.owner.toString() === req.user.id
      });

      // Check ownership with detailed logging
      if (table.owner.toString() !== req.user.id) {
        console.log('❌ Access denied - ownership mismatch');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view sessions for your own tables.',
          debug: process.env.NODE_ENV === 'development' ? {
            tableOwner: table.owner.toString(),
            currentUser: req.user.id,
            tableName: table.name,
            tableId: tableId
          } : undefined
        });
      }

      // Look for active session
      const session = await Session.getActiveSession(tableId);
      
      if (!session) {
        console.log('ℹ️ No active session found for table:', tableId);
        return res.status(404).json({
          success: false,
          message: 'No active session found for this table'
        });
      }

      // Calculate current cost and duration
      const currentCost = session.calculateCurrentCost();
      const durationMinutes = session.getDurationInMinutes();

      console.log('✅ Active session found:', {
        sessionId: session._id,
        customer: session.customerName,
        cost: currentCost,
        duration: durationMinutes,
        items: session.items.length,
        paymentStatus: session.paymentStatus // 🆕 NEW: Log payment status
      });

      res.json({
        success: true,
        data: {
          session: {
            ...session.toObject(),
            currentCost,
            durationMinutes
          },
          accessedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Get active session error:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid table ID format'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error while fetching session',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // @desc    Add item to session
  // @access  Private (session owner only)
  async addItemToSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { productId, quantity } = req.body;

      console.log('📦 Adding item to session:', {
        sessionId,
        productId,
        quantity,
        userId: req.user?.id
      });

      // Validate input
      if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Product ID and valid quantity are required'
        });
      }

      // Find session
      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check ownership
      if (session.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only add items to your own sessions.'
        });
      }

      // Can only add items to active or paused sessions
      if (!['active', 'paused'].includes(session.status)) {
        return res.status(400).json({
          success: false,
          message: 'Can only add items to active or paused sessions'
        });
      }

      // Find product
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Check product ownership
      if (product.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied for this product'
        });
      }

      // Check stock availability
      if (product.currentStock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.currentStock}, Requested: ${quantity}`
        });
      }

      // Add item to session
      await session.addItem({
        product: product._id,
        productName: product.name,
        quantity: parseInt(quantity),
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice
      });

      // Update product stock
      await product.updateStock(quantity, 'subtract');

      // Populate for response
      await session.populate('table', 'name tableNumber');
      await session.populate('items.product', 'name category unit');

      console.log('✅ Item added to session successfully:', {
        sessionId: session._id,
        productName: product.name,
        quantity,
        newItemsTotal: session.items.length
      });

      res.json({
        success: true,
        message: 'Item added to session successfully!',
        data: {
          session: session.toObject(),
          addedItem: session.items[session.items.length - 1],
          updatedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Add item to session error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while adding item to session'
      });
    }
  }

  // @desc    Remove item from session
  // @access  Private (session owner only)
  async removeItemFromSession(req, res) {
    try {
      const { sessionId, itemId } = req.params;

      console.log('📦 Removing item from session:', {
        sessionId,
        itemId,
        userId: req.user?.id
      });

      // Find session
      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check ownership
      if (session.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only modify your own sessions.'
        });
      }

      // Can only remove items from active or paused sessions
      if (!['active', 'paused'].includes(session.status)) {
        return res.status(400).json({
          success: false,
          message: 'Can only remove items from active or paused sessions'
        });
      }

      // Find the item
      const item = session.items.find(item => item._id.toString() === itemId);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Item not found in this session'
        });
      }

      // Get product to restore stock
      const product = await Product.findById(item.product);
      if (product) {
        await product.updateStock(item.quantity, 'add');
      }

      // Remove item from session
      await session.removeItem(itemId);

      // Populate for response
      await session.populate('table', 'name tableNumber');
      await session.populate('items.product', 'name category unit');

      console.log('✅ Item removed from session successfully:', {
        sessionId: session._id,
        removedItemId: itemId,
        newItemsTotal: session.items.length
      });

      res.json({
        success: true,
        message: 'Item removed from session successfully!',
        data: {
          session: session.toObject(),
          removedItemId: itemId,
          updatedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Remove item from session error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while removing item from session'
      });
    }
  }

  // @desc    Update session (add frames/kittis, pause/resume, add notes)
  // @access  Private (session owner only)
  async updateSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { frames, kittis, notes, action } = req.body;

      console.log('🎯 Updating session:', {
        sessionId,
        frames,
        kittis,
        action,
        userId: req.user?.id
      });

      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check ownership
      if (session.owner.toString() !== req.user.id) {
        console.log('❌ Access denied - session ownership mismatch');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only update your own sessions.'
        });
      }

      // Can only update active sessions (unless it's adding final notes)
      if (session.status !== 'active' && session.status !== 'paused' && action !== 'add_notes') {
        return res.status(400).json({
          success: false,
          message: 'Can only update active or paused sessions'
        });
      }

      // Handle different update actions
      switch (action) {
        case 'pause':
          if (session.status === 'active') {
            session.status = 'paused';
            session.pausedAt = new Date();
          }
          break;
          
        case 'resume':
          if (session.status === 'paused') {
            session.status = 'active';
            // Add paused time to total paused duration
            if (session.pausedAt) {
              const pausedDuration = new Date() - session.pausedAt;
              session.totalPausedTime = (session.totalPausedTime || 0) + pausedDuration;
              session.pausedAt = null;
            }
          }
          break;
          
        case 'update_frames_kittis':
          if (session.pricingMethod === 'frame_kitti') {
            if (frames !== undefined) session.frames = Math.max(0, frames);
            if (kittis !== undefined) session.kittis = Math.max(0, kittis);
          }
          break;
          
        case 'add_notes':
          if (notes !== undefined) session.notes = notes;
          break;
          
        default:
          // Default behavior - update frames/kittis and notes
          if (frames !== undefined) session.frames = Math.max(0, frames);
          if (kittis !== undefined) session.kittis = Math.max(0, kittis);
          if (notes !== undefined) session.notes = notes;
      }
      
      // Track who modified this session
      session.lastModifiedBySession = req.session?.id;
      session.lastModifiedAt = new Date();

      // Update total cost
      await session.updateTotalCost();

      // Populate for response
      await session.populate('table', 'name tableNumber');
      await session.populate('items.product', 'name category unit');

      // Calculate current values for response
      const currentCost = session.calculateCurrentCost();
      const durationMinutes = session.getDurationInMinutes();

      console.log('✅ Session updated successfully:', {
        sessionId: session._id,
        newFrames: session.frames,
        newKittis: session.kittis,
        newCost: currentCost,
        itemsCount: session.items.length
      });

      res.json({
        success: true,
        message: 'Session updated successfully',
        data: {
          session: {
            ...session.toObject(),
            currentCost,
            durationMinutes
          },
          updatedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Update session error:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid session ID'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error during update'
      });
    }
  }

  // 🆕 NEW: Confirm payment before ending session
  // @desc    Confirm payment details before ending session
  // @access  Private (session owner only)
  async confirmPayment(req, res) {
    try {
      const { sessionId } = req.params;
      const { paymentStatus, paymentMethod, transactionId, paymentNotes } = req.body;

      console.log('💰 Confirming payment for session:', {
        sessionId,
        paymentStatus,
        paymentMethod,
        userId: req.user?.id
      });

      // Validate input
      const validPaymentStatuses = ['paid', 'credit'];
      const validPaymentMethods = ['esewa', 'online_banking', 'cash'];

      if (!validPaymentStatuses.includes(paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Payment status must be either "paid" or "credit"'
        });
      }

      if (paymentStatus === 'paid' && !validPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: 'Valid payment method is required when marking as paid'
        });
      }

      // Find session
      const session = await Session.findById(sessionId).populate('table');
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check ownership
      if (session.owner.toString() !== req.user.id) {
        console.log('❌ Access denied - session ownership mismatch for payment confirmation');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only confirm payment for your own sessions.'
        });
      }

      // Can only confirm payment for active or paused sessions
      if (!['active', 'paused'].includes(session.status)) {
        return res.status(400).json({
          success: false,
          message: 'Can only confirm payment for active or paused sessions'
        });
      }

      // Calculate final cost before processing payment
      await session.updateTotalCost();

      // Process payment based on status
      if (paymentStatus === 'paid') {
        // Mark as paid with payment method
        await session.markAsPaid({
          method: paymentMethod,
          transactionId: transactionId || '',
          notes: paymentNotes || ''
        });

        console.log('✅ Session marked as paid:', {
          sessionId: session._id,
          method: paymentMethod,
          amount: session.totalCost
        });

      } else if (paymentStatus === 'credit') {
        // Mark as credit
        await session.markAsCredit(paymentNotes || 'Payment credited - to be collected later');

        console.log('✅ Session marked as credit:', {
          sessionId: session._id,
          amount: session.totalCost
        });
      }

      // Refresh session data
      await session.populate('table', 'name tableNumber');
      await session.populate('items.product', 'name category unit');

      res.json({
        success: true,
        message: `Payment ${paymentStatus === 'paid' ? 'confirmed' : 'credited'} successfully!`,
        data: {
          session: session.toObject(),
          paymentSummary: session.getPaymentSummary(),
          updatedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Confirm payment error:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid session ID'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error during payment confirmation'
      });
    }
  }

  // 🆕 UPDATED: End session with payment validation
  // @desc    End a session (requires payment confirmation)
  // @access  Private (session owner only)
  async endSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { notes } = req.body;

      console.log('🎯 Ending session:', {
        sessionId,
        userId: req.user?.id,
        notes: notes ? 'Has notes' : 'No notes'
      });

      const session = await Session.findById(sessionId).populate('table');
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check ownership
      if (session.owner.toString() !== req.user.id) {
        console.log('❌ Access denied - session ownership mismatch for end');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only end your own sessions.'
        });
      }

      // Can only end active or paused sessions
      if (!['active', 'paused'].includes(session.status)) {
        return res.status(400).json({
          success: false,
          message: 'Session is not active or paused'
        });
      }

      // 🆕 NEW: Check if payment has been confirmed
      if (session.paymentStatus === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Payment confirmation required before ending session',
          requiresPaymentConfirmation: true,
          sessionCost: session.calculateCurrentCost()
        });
      }

      // End session
      session.status = 'completed';
      session.endTime = new Date();
      if (notes) session.notes = notes;
      session.lastModifiedBySession = req.session?.id;
      session.lastModifiedAt = new Date();

      // If session was paused when ended, calculate final paused time
      if (session.pausedAt) {
        const finalPausedDuration = new Date() - session.pausedAt;
        session.totalPausedTime = (session.totalPausedTime || 0) + finalPausedDuration;
        session.pausedAt = null;
      }

      // Calculate final cost
      await session.updateTotalCost();

      // Free up the table
      const table = session.table;
      if (table) {
        table.isOccupied = false;
        table.currentBooking = null;
        await table.save();
      }

      // Calculate final values
      const finalCost = session.totalCost;
      const totalDurationMinutes = session.getDurationInMinutes();
      const paymentSummary = session.getPaymentSummary();

      console.log('✅ Session ended successfully:', {
        sessionId: session._id,
        finalCost,
        totalDuration: totalDurationMinutes,
        itemsCount: session.items.length,
        itemsRevenue: session.totalItemsRevenue,
        paymentStatus: session.paymentStatus,
        paymentMethod: session.paymentMethodLabel
      });

      res.json({
        success: true,
        message: 'Session ended successfully',
        data: {
          session: {
            ...session.toObject(),
            finalCost,
            totalDurationMinutes
          },
          paymentSummary,
          endedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 End session error:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid session ID'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error during session end'
      });
    }
  }

  // @desc    Get all sessions for user's snooker house with filtering and pagination
  // @access  Private
  async getMySessions(req, res) {
    try {
      const { status, limit = 50, skip = 0, dateFrom, dateTo, tableId, paymentStatus } = req.query;

      console.log('🎯 Getting user sessions:', {
        userId: req.user?.id,
        filters: { status, limit, skip, dateFrom, dateTo, tableId, paymentStatus }
      });

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

      if (status) options.status = status;
      if (paymentStatus) options.paymentStatus = paymentStatus; // 🆕 NEW: Payment status filter
      if (dateFrom) options.dateFrom = dateFrom;
      if (dateTo) options.dateTo = dateTo;
      if (tableId) options.tableId = tableId;

      const sessions = await Session.getBySnookerHouse(snookerHouse._id, options);

      // Add calculated values for each session
      const sessionsWithCalculations = sessions.map(session => ({
        ...session.toObject(),
        currentCost: session.calculateCurrentCost(),
        durationMinutes: session.getDurationInMinutes()
      }));

      // Get session statistics with payment breakdown
      const totalSessions = await Session.countDocuments({ snookerHouse: snookerHouse._id });
      const activeSessions = await Session.countDocuments({ 
        snookerHouse: snookerHouse._id, 
        status: 'active' 
      });
      const pausedSessions = await Session.countDocuments({ 
        snookerHouse: snookerHouse._id, 
        status: 'paused' 
      });
      const todaySessions = await Session.countDocuments({
        snookerHouse: snookerHouse._id,
        createdAt: { 
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      });

      // 🆕 NEW: Payment statistics
      const paidSessions = await Session.countDocuments({
        snookerHouse: snookerHouse._id,
        paymentStatus: 'paid'
      });
      
      const creditSessions = await Session.countDocuments({
        snookerHouse: snookerHouse._id,
        paymentStatus: 'credit'
      });
      
      const pendingPaymentSessions = await Session.countDocuments({
        snookerHouse: snookerHouse._id,
        paymentStatus: 'pending'
      });

      console.log('✅ Sessions retrieved:', {
        total: totalSessions,
        returned: sessions.length,
        active: activeSessions,
        paid: paidSessions,
        credit: creditSessions,
        pending: pendingPaymentSessions
      });

      res.json({
        success: true,
        data: {
          sessions: sessionsWithCalculations,
          statistics: {
            total: totalSessions,
            active: activeSessions,
            paused: pausedSessions,
            today: todaySessions,
            returned: sessions.length,
            // 🆕 NEW: Payment statistics
            paymentBreakdown: {
              paid: paidSessions,
              credit: creditSessions,
              pending: pendingPaymentSessions
            }
          },
          pagination: {
            limit: parseInt(limit),
            skip: parseInt(skip),
            hasMore: sessions.length === parseInt(limit)
          },
          accessedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Get sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Cancel/Delete a session (only if not completed)
  // @access  Private
  async cancelSession(req, res) {
    try {
      const { sessionId } = req.params;

      console.log('🎯 Cancelling session:', {
        sessionId,
        userId: req.user?.id
      });

      const session = await Session.findById(sessionId).populate('table');
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check ownership
      if (session.owner.toString() !== req.user.id) {
        console.log('❌ Access denied - session ownership mismatch for cancel');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only cancel your own sessions.'
        });
      }

      // Can only cancel if not completed
      if (session.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel completed sessions'
        });
      }

      // Restore stock for all items in session
      for (const item of session.items) {
        const product = await Product.findById(item.product);
        if (product) {
          await product.updateStock(item.quantity, 'add');
          console.log(`✅ Restored ${item.quantity} units of ${item.productName} to stock`);
        }
      }

      // Mark session as cancelled
      session.status = 'cancelled';
      session.endTime = new Date();
      session.lastModifiedBySession = req.session?.id;
      session.lastModifiedAt = new Date();

      // 🆕 NEW: Reset payment status for cancelled sessions
      session.paymentStatus = 'pending';
      session.paymentMethod = null;
      session.paymentMethodLabel = null;
      session.totalPaidAmount = 0;
      session.remainingAmount = 0;
      session.payments = [];
      session.paymentNotes = 'Session cancelled - payment reset';

      await session.save();

      // Free up the table if it was occupied
      if (session.table) {
        const table = session.table;
        table.isOccupied = false;
        table.currentBooking = null;
        await table.save();
      }

      console.log('✅ Session cancelled successfully:', {
        sessionId: session._id,
        restoredItems: session.items.length
      });

      res.json({
        success: true,
        message: 'Session cancelled successfully',
        data: {
          session: session.toObject(),
          restoredItems: session.items.length,
          cancelledBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Cancel session error:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid session ID'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // 🆕 UPDATED: Get session statistics with payment breakdown
  // @desc    Get session statistics for user's snooker house
  // @access  Private
  async getSessionStats(req, res) {
    try {
      console.log('📊 Getting session statistics for user:', req.user?.id);

      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      // Get various statistics
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfYear = new Date(today.getFullYear(), 0, 1);

      const [
        totalSessions,
        activeSessions,
        pausedSessions,
        todaySessions,
        weekSessions,
        monthSessions,
        yearSessions,
        completedSessions,
        cancelledSessions,
        // 🆕 NEW: Payment statistics
        paidSessions,
        creditSessions,
        pendingPaymentSessions
      ] = await Promise.all([
        Session.countDocuments({ snookerHouse: snookerHouse._id }),
        Session.countDocuments({ snookerHouse: snookerHouse._id, status: 'active' }),
        Session.countDocuments({ snookerHouse: snookerHouse._id, status: 'paused' }),
        Session.countDocuments({ 
          snookerHouse: snookerHouse._id,
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        }),
        Session.countDocuments({ 
          snookerHouse: snookerHouse._id,
          createdAt: { $gte: startOfWeek }
        }),
        Session.countDocuments({ 
          snookerHouse: snookerHouse._id,
          createdAt: { $gte: startOfMonth }
        }),
        Session.countDocuments({ 
          snookerHouse: snookerHouse._id,
          createdAt: { $gte: startOfYear }
        }),
        Session.countDocuments({ snookerHouse: snookerHouse._id, status: 'completed' }),
        Session.countDocuments({ snookerHouse: snookerHouse._id, status: 'cancelled' }),
        // Payment counts
        Session.countDocuments({ snookerHouse: snookerHouse._id, paymentStatus: 'paid' }),
        Session.countDocuments({ snookerHouse: snookerHouse._id, paymentStatus: 'credit' }),
        Session.countDocuments({ snookerHouse: snookerHouse._id, paymentStatus: 'pending' })
      ]);

      // Get today's revenue with payment breakdown
      const todayRevenue = await Session.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouse._id, 
            status: 'completed',
            endTime: { $gte: startOfDay, $lte: endOfDay }
          } 
        },
        {
          $group: {
            _id: null,
            todayGameRevenue: { $sum: '$gameCost' },
            todayItemsRevenue: { $sum: '$totalItemsRevenue' },
            todayItemsProfit: { $sum: '$totalItemsProfit' },
            todayTotalRevenue: { $sum: '$totalCost' },
            todayItems: { $sum: '$totalItems' },
            // 🆕 NEW: Payment method breakdown
            todayPaidAmount: { 
              $sum: { 
                $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalPaidAmount', 0] 
              } 
            },
            todayCreditAmount: { 
              $sum: { 
                $cond: [{ $eq: ['$paymentStatus', 'credit'] }, '$totalCost', 0] 
              } 
            }
          }
        }
      ]);

      // Get total revenue statistics with payment breakdown
      const revenueStats = await Session.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouse._id, 
            status: 'completed'
          } 
        },
        {
          $group: {
            _id: null,
            totalGameRevenue: { $sum: '$gameCost' },
            totalItemsRevenue: { $sum: '$totalItemsRevenue' },
            totalItemsProfit: { $sum: '$totalItemsProfit' },
            totalRevenue: { $sum: '$totalCost' },
            averageSession: { $avg: '$totalCost' },
            totalItems: { $sum: '$totalItems' },
            // 🆕 NEW: Payment breakdowns
            totalPaidAmount: { 
              $sum: { 
                $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalPaidAmount', 0] 
              } 
            },
            totalCreditAmount: { 
              $sum: { 
                $cond: [{ $eq: ['$paymentStatus', 'credit'] }, '$totalCost', 0] 
              } 
            },
            totalOutstanding: { $sum: '$remainingAmount' }
          }
        }
      ]);

      // 🆕 NEW: Get payment method breakdown
      const paymentMethodStats = await Session.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouse._id, 
            status: 'completed',
            paymentStatus: 'paid'
          } 
        },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            amount: { $sum: '$totalPaidAmount' }
          }
        }
      ]);

      // Get most active table
      const tableStats = await Session.aggregate([
        { $match: { snookerHouse: snookerHouse._id } },
        { $group: { _id: '$table', sessionCount: { $sum: 1 } } },
        { $sort: { sessionCount: -1 } },
        { $limit: 1 },
        { $lookup: { from: 'tables', localField: '_id', foreignField: '_id', as: 'tableInfo' } }
      ]);

      const revenue = revenueStats[0] || { 
        totalGameRevenue: 0, 
        totalItemsRevenue: 0,
        totalItemsProfit: 0,
        totalRevenue: 0, 
        averageSession: 0,
        totalItems: 0,
        totalPaidAmount: 0,
        totalCreditAmount: 0,
        totalOutstanding: 0
      };

      const todayRev = todayRevenue[0] || { 
        todayGameRevenue: 0,
        todayItemsRevenue: 0,
        todayItemsProfit: 0,
        todayTotalRevenue: 0,
        todayItems: 0,
        todayPaidAmount: 0,
        todayCreditAmount: 0
      };

      // Format payment methods breakdown
      const paymentMethods = {
        esewa: { count: 0, amount: 0 },
        online_banking: { count: 0, amount: 0 },
        cash: { count: 0, amount: 0 }
      };

      paymentMethodStats.forEach(stat => {
        if (stat._id && paymentMethods[stat._id]) {
          paymentMethods[stat._id] = {
            count: stat.count,
            amount: Math.round(stat.amount)
          };
        }
      });

      const stats = {
        sessions: {
          total: totalSessions,
          active: activeSessions,
          paused: pausedSessions,
          completed: completedSessions,
          cancelled: cancelledSessions,
          today: todaySessions,
          thisWeek: weekSessions,
          thisMonth: monthSessions,
          thisYear: yearSessions
        },
        revenue: {
          totalGame: Math.round(revenue.totalGameRevenue),
          totalItems: Math.round(revenue.totalItemsRevenue),
          totalItemsProfit: Math.round(revenue.totalItemsProfit),
          totalRevenue: Math.round(revenue.totalRevenue),
          average: Math.round(revenue.averageSession),
          todayGame: Math.round(todayRev.todayGameRevenue),
          todayItems: Math.round(todayRev.todayItemsRevenue),
          todayItemsProfit: Math.round(todayRev.todayItemsProfit),
          todayTotal: Math.round(todayRev.todayTotalRevenue)
        },
        // 🆕 NEW: Payment statistics
        payments: {
          paid: paidSessions,
          credit: creditSessions,
          pending: pendingPaymentSessions,
          totalPaidAmount: Math.round(revenue.totalPaidAmount),
          totalCreditAmount: Math.round(revenue.totalCreditAmount),
          totalOutstanding: Math.round(revenue.totalOutstanding),
          todayPaidAmount: Math.round(todayRev.todayPaidAmount),
          todayCreditAmount: Math.round(todayRev.todayCreditAmount),
          paymentMethods
        },
        items: {
          totalSold: revenue.totalItems,
          todaySold: todayRev.todayItems,
          totalProfit: Math.round(revenue.totalItemsProfit),
          todayProfit: Math.round(todayRev.todayItemsProfit)
        },
        tables: {
          mostActive: tableStats[0] ? {
            name: tableStats[0].tableInfo[0]?.name || 'Unknown',
            sessionCount: tableStats[0].sessionCount
          } : null
        },
        accessedBy: {
          sessionId: req.session?.id,
          deviceInfo: req.session?.deviceInfo
        }
      };

      console.log('✅ Session statistics retrieved:', {
        total: totalSessions,
        active: activeSessions,
        revenue: stats.revenue.totalRevenue,
        itemsRevenue: stats.revenue.totalItems,
        paymentStats: {
          paid: paidSessions,
          credit: creditSessions,
          pending: pendingPaymentSessions
        }
      });

      res.json({
        success: true,
        data: { stats }
      });

    } catch (error) {
      console.error('💥 Get session stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Get specific session details
  // @access  Private (session owner only)
  async getSessionById(req, res) {
    try {
      const { sessionId } = req.params;

      console.log('🎯 Getting session details:', {
        sessionId,
        userId: req.user?.id
      });

      const session = await Session.findById(sessionId)
        .populate('table', 'name tableNumber')
        .populate('snookerHouse', 'name address')
        .populate('items.product', 'name category unit');

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check ownership
      if (session.owner.toString() !== req.user.id) {
        console.log('❌ Access denied - session ownership mismatch for get details');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own sessions.'
        });
      }

      // Calculate current cost and duration
      const currentCost = session.calculateCurrentCost();
      const durationMinutes = session.getDurationInMinutes();

      console.log('✅ Session details retrieved:', {
        sessionId: session._id,
        status: session.status,
        cost: currentCost,
        itemsCount: session.items.length,
        paymentStatus: session.paymentStatus
      });

      res.json({
        success: true,
        data: {
          session: {
            ...session.toObject(),
            currentCost,
            durationMinutes
          },
          accessedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Get session details error:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid session ID'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Pause an active session
  // @access  Private (session owner only)
  async pauseSession(req, res) {
    try {
      const { sessionId } = req.params;

      console.log('⏸️ Pausing session:', {
        sessionId,
        userId: req.user?.id
      });

      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check ownership
      if (session.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only pause your own sessions.'
        });
      }

      // Can only pause active sessions
      if (session.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Session is not active'
        });
      }

      // Pause the session
      session.status = 'paused';
      session.pausedAt = new Date();
      session.lastModifiedBySession = req.session?.id;
      session.lastModifiedAt = new Date();
      await session.save();

      console.log('✅ Session paused successfully:', {
        sessionId: session._id
      });

      res.json({
        success: true,
        message: 'Session paused successfully',
        data: {
          session: session.toObject(),
          pausedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Pause session error:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid session ID'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Resume a paused session
  // @access  Private (session owner only)
  async resumeSession(req, res) {
    try {
      const { sessionId } = req.params;

      console.log('▶️ Resuming session:', {
        sessionId,
        userId: req.user?.id
      });

      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check ownership
      if (session.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only resume your own sessions.'
        });
      }

      // Can only resume paused sessions
      if (session.status !== 'paused') {
        return res.status(400).json({
          success: false,
          message: 'Session is not paused'
        });
      }

      // Resume the session
      session.status = 'active';
      
      // Calculate and add paused duration
      if (session.pausedAt) {
        const pausedDuration = new Date() - session.pausedAt;
        session.totalPausedTime = (session.totalPausedTime || 0) + pausedDuration;
        session.pausedAt = null;
      }
      
      session.lastModifiedBySession = req.session?.id;
      session.lastModifiedAt = new Date();
      await session.save();

      console.log('✅ Session resumed successfully:', {
        sessionId: session._id
      });

      res.json({
        success: true,
        message: 'Session resumed successfully',
        data: {
          session: session.toObject(),
          resumedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Resume session error:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid session ID'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Get session history for a specific table
  // @access  Private (table owner only)
  async getTableSessionHistory(req, res) {
    try {
      const { tableId } = req.params;
      const { limit = 20, skip = 0, status, paymentStatus } = req.query;

      console.log('📋 Getting table session history:', {
        tableId,
        userId: req.user?.id,
        filters: { limit, skip, status, paymentStatus }
      });

      // Verify table ownership
      const table = await Table.findById(tableId);
      if (!table) {
        return res.status(404).json({
          success: false,
          message: 'Table not found'
        });
      }

      if (table.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view history for your own tables.'
        });
      }

      // Build query
      const query = { table: tableId };
      if (status) query.status = status;
      if (paymentStatus) query.paymentStatus = paymentStatus; // 🆕 NEW: Payment status filter

      // Get sessions
      const sessions = await Session.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .populate('table', 'name tableNumber')
        .populate('items.product', 'name category unit');

      // Get total count for pagination
      const totalSessions = await Session.countDocuments(query);

      // Add calculated values
      const sessionsWithCalculations = sessions.map(session => ({
        ...session.toObject(),
        finalCost: session.status === 'completed' ? session.totalCost : session.calculateCurrentCost(),
        durationMinutes: session.getDurationInMinutes()
      }));

      console.log('✅ Table session history retrieved:', {
        tableId,
        returned: sessions.length,
        total: totalSessions
      });

      res.json({
        success: true,
        data: {
          sessions: sessionsWithCalculations,
          pagination: {
            total: totalSessions,
            limit: parseInt(limit),
            skip: parseInt(skip),
            hasMore: parseInt(skip) + sessions.length < totalSessions
          },
          table: {
            id: table._id,
            name: table.name,
            tableNumber: table.tableNumber
          }
        }
      });

    } catch (error) {
      console.error('💥 Get table history error:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid table ID'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // 🆕 UPDATED: Export session data with payment information
  // @desc    Export session data (CSV/JSON)
  // @access  Private
  async exportSessions(req, res) {
    try {
      const { format = 'json', dateFrom, dateTo, status, paymentStatus } = req.query;

      console.log('📤 Exporting session data:', {
        userId: req.user?.id,
        format,
        filters: { dateFrom, dateTo, status, paymentStatus }
      });

      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      // Build query
      const query = { snookerHouse: snookerHouse._id };
      if (status) query.status = status;
      if (paymentStatus) query.paymentStatus = paymentStatus; // 🆕 NEW: Payment status filter
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      // Get sessions with populated data
      const sessions = await Session.find(query)
        .populate('table', 'name tableNumber')
        .populate('items.product', 'name category unit')
        .sort({ createdAt: -1 });

      // Prepare export data with payment information
      const exportData = sessions.map(session => ({
        sessionId: session._id,
        tableName: session.table?.name,
        tableNumber: session.table?.tableNumber,
        customerName: session.customerName,
        customerPhone: session.customerPhone,
        status: session.status,
        pricingMethod: session.pricingMethod,
        startTime: session.startTime,
        endTime: session.endTime,
        durationMinutes: session.getDurationInMinutes(),
        frames: session.frames || 0,
        kittis: session.kittis || 0,
        gameCost: session.gameCost || 0,
        itemsCount: session.items.length,
        itemsRevenue: session.totalItemsRevenue || 0,
        itemsProfit: session.totalItemsProfit || 0,
        totalCost: session.status === 'completed' ? session.totalCost : session.calculateCurrentCost(),
        // 🆕 NEW: Payment information
        paymentStatus: session.paymentStatus,
        paymentMethod: session.paymentMethodLabel || '',
        totalPaidAmount: session.totalPaidAmount || 0,
        remainingAmount: session.remainingAmount || 0,
        paymentCompletedAt: session.paymentCompletedAt,
        paymentNotes: session.paymentNotes || '',
        notes: session.notes,
        createdAt: session.createdAt
      }));

      if (format === 'csv') {
        // Convert to CSV format
        const csvHeader = Object.keys(exportData[0] || {}).join(',');
        const csvRows = exportData.map(row => 
          Object.values(row).map(value => 
            typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
          ).join(',')
        );
        const csvContent = [csvHeader, ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="sessions-${Date.now()}.csv"`);
        res.send(csvContent);
      } else {
        // JSON format
        res.json({
          success: true,
          data: {
            sessions: exportData,
            exportInfo: {
              total: exportData.length,
              snookerHouse: snookerHouse.name,
              exportedAt: new Date(),
              filters: { status, paymentStatus, dateFrom, dateTo }
            }
          }
        });
      }

      console.log('✅ Session data exported:', {
        format,
        count: exportData.length
      });

    } catch (error) {
      console.error('💥 Export sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during export'
      });
    }
  }

  // @desc    Perform bulk actions on multiple sessions
  // @access  Private
  async bulkSessionAction(req, res) {
    try {
      const { sessionIds, action } = req.body;

      console.log('🔄 Bulk session action:', {
        userId: req.user?.id,
        action,
        sessionCount: sessionIds?.length
      });

      if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Session IDs array is required'
        });
      }

      if (!['cancel', 'delete', 'export'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Allowed actions: cancel, delete, export'
        });
      }

      // Verify all sessions belong to the user
      const sessions = await Session.find({
        _id: { $in: sessionIds },
        owner: req.user.id
      }).populate('items.product');

      if (sessions.length !== sessionIds.length) {
        return res.status(403).json({
          success: false,
          message: 'Some sessions do not belong to you or do not exist'
        });
      }

      let results = [];

      switch (action) {
        case 'cancel':
          for (const session of sessions) {
            if (!['completed', 'cancelled'].includes(session.status)) {
              // Restore stock for all items
              for (const item of session.items) {
                const product = await Product.findById(item.product);
                if (product) {
                  await product.updateStock(item.quantity, 'add');
                }
              }

              session.status = 'cancelled';
              session.endTime = new Date();
              session.lastModifiedBySession = req.session?.id;
              
              // 🆕 NEW: Reset payment status for cancelled sessions
              session.paymentStatus = 'pending';
              session.paymentMethod = null;
              session.paymentMethodLabel = null;
              session.totalPaidAmount = 0;
              session.remainingAmount = 0;
              session.payments = [];
              session.paymentNotes = 'Session cancelled - payment reset';
              
              await session.save();

              // Free up table if needed
              if (session.table) {
                await Table.findByIdAndUpdate(session.table, {
                  isOccupied: false,
                  currentBooking: null
                });
              }
              results.push({ sessionId: session._id, success: true });
            } else {
              results.push({ 
                sessionId: session._id, 
                success: false, 
                reason: 'Already completed or cancelled' 
              });
            }
          }
          break;

        case 'delete':
          // Only allow deletion of cancelled sessions
          for (const session of sessions) {
            if (session.status === 'cancelled') {
              await Session.findByIdAndDelete(session._id);
              results.push({ sessionId: session._id, success: true });
            } else {
              results.push({ 
                sessionId: session._id, 
                success: false, 
                reason: 'Can only delete cancelled sessions' 
              });
            }
          }
          break;

        case 'export':
          // Export specific sessions with payment information
          const exportData = sessions.map(session => ({
            sessionId: session._id,
            customerName: session.customerName,
            status: session.status,
            startTime: session.startTime,
            endTime: session.endTime,
            gameCost: session.gameCost,
            itemsRevenue: session.totalItemsRevenue,
            totalCost: session.totalCost,
            itemsCount: session.items.length,
            // 🆕 NEW: Payment information in export
            paymentStatus: session.paymentStatus,
            paymentMethod: session.paymentMethodLabel || '',
            totalPaidAmount: session.totalPaidAmount || 0,
            remainingAmount: session.remainingAmount || 0,
            notes: session.notes
          }));
          
          return res.json({
            success: true,
            data: {
              exportedSessions: exportData,
              message: `${sessions.length} sessions exported`
            }
          });
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log('✅ Bulk action completed:', {
        action,
        success: successCount,
        failed: failureCount
      });

      res.json({
        success: true,
        data: {
          message: `Bulk ${action} completed: ${successCount} successful, ${failureCount} failed`,
          results,
          summary: {
            total: results.length,
            successful: successCount,
            failed: failureCount
          }
        }
      });

    } catch (error) {
      console.error('💥 Bulk action error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during bulk action'
      });
    }
  }

  // 🆕 NEW: Get payment summary for dashboard
  // @desc    Get payment summary and statistics
  // @access  Private
  async getPaymentSummary(req, res) {
    try {
      const { period = 'today' } = req.query;

      console.log('💰 Getting payment summary:', {
        userId: req.user?.id,
        period
      });

      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      // Calculate date range based on period
      let startDate, endDate;
      const now = new Date();

      switch (period) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          endDate = new Date(now.setHours(23, 59, 59, 999));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - now.getDay()));
          endDate = new Date();
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date();
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date();
          break;
        default:
          startDate = new Date(now.setHours(0, 0, 0, 0));
          endDate = new Date(now.setHours(23, 59, 59, 999));
      }

      // Get payment statistics
      const paymentStats = await Session.getPaymentStats(snookerHouse._id, startDate, endDate);

      // Get recent credit sessions
      const creditSessions = await Session.find({
        snookerHouse: snookerHouse._id,
        paymentStatus: 'credit',
        status: 'completed'
      })
      .populate('table', 'name tableNumber')
      .sort({ endTime: -1 })
      .limit(10);

      // Get payment method breakdown for the period
      const paymentMethodBreakdown = await Session.aggregate([
        {
          $match: {
            snookerHouse: snookerHouse._id,
            status: 'completed',
            paymentStatus: 'paid',
            endTime: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalPaidAmount' }
          }
        }
      ]);

      // Format the response
      const summary = {
        period,
        dateRange: { startDate, endDate },
        totals: {
          paid: 0,
          credit: 0,
          pending: 0,
          totalAmount: 0,
          paidAmount: 0,
          creditAmount: 0,
          outstandingAmount: 0
        },
        paymentMethods: {
          esewa: { count: 0, amount: 0 },
          online_banking: { count: 0, amount: 0 },
          cash: { count: 0, amount: 0 }
        },
        creditSessions: creditSessions.map(session => ({
          id: session._id,
          customerName: session.customerName,
          tableName: session.table?.name,
          amount: session.totalCost,
          endTime: session.endTime,
          notes: session.paymentNotes
        }))
      };

      // Process payment stats
      paymentStats.forEach(stat => {
        summary.totals[stat._id] = stat.count;
        if (stat._id === 'paid') {
          summary.totals.paidAmount = Math.round(stat.totalPaid);
        } else if (stat._id === 'credit') {
          summary.totals.creditAmount = Math.round(stat.totalAmount);
          summary.totals.outstandingAmount = Math.round(stat.totalAmount - stat.totalPaid);
        }
        summary.totals.totalAmount += Math.round(stat.totalAmount);
      });

      // Process payment method breakdown
      paymentMethodBreakdown.forEach(method => {
        if (method._id && summary.paymentMethods[method._id]) {
          summary.paymentMethods[method._id] = {
            count: method.count,
            amount: Math.round(method.totalAmount)
          };
        }
      });

      console.log('✅ Payment summary retrieved:', {
        period,
        totalSessions: summary.totals.paid + summary.totals.credit + summary.totals.pending,
        totalAmount: summary.totals.totalAmount,
        creditSessions: summary.creditSessions.length
      });

      res.json({
        success: true,
        data: { summary }
      });

    } catch (error) {
      console.error('💥 Get payment summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching payment summary'
      });
    }
  }
}

module.exports = new SessionController();