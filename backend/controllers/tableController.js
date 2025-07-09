const Table = require('../models/Table');
const SnookerHouse = require('../models/SnookerHouse');

class TableController {
  // @desc    Create a new table
  // @access  Private (snooker house owner only)
  async createTable(req, res) {
    try {
      const { tableNumber, name, pricingMethod, hourlyRate, frameRate, kittiRate, description } = req.body;

      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'You need to create a snooker house first before adding tables'
        });
      }

      // If table number not provided, get next available
      let finalTableNumber = tableNumber;
      if (!finalTableNumber) {
        finalTableNumber = await Table.getNextTableNumber(snookerHouse._id);
      }

      // Check if table number already exists in this snooker house
      const existingTable = await Table.findOne({ 
        snookerHouse: snookerHouse._id, 
        tableNumber: finalTableNumber 
      });
      
      if (existingTable) {
        return res.status(400).json({
          success: false,
          message: `Table number ${finalTableNumber} already exists in your snooker house`
        });
      }

      // Create table data object
      const tableData = {
        tableNumber: finalTableNumber,
        name,
        pricingMethod,
        description: description || '',
        snookerHouse: snookerHouse._id,
        owner: req.user.id
      };

      // Add pricing rates based on method
      if (pricingMethod === 'per_minute') {
        tableData.hourlyRate = hourlyRate;
      } else if (pricingMethod === 'frame_kitti') {
        tableData.frameRate = frameRate;
        tableData.kittiRate = kittiRate;
      }

      // Create new table
      const table = new Table(tableData);
      await table.save();

      // Populate references for response
      await table.populate('snookerHouse', 'name address');

      res.status(201).json({
        success: true,
        message: 'Table created successfully!',
        data: {
          table: table.toJSON(),
          createdBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('Table creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during table creation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // @desc    Get all tables for user's snooker house
  // @access  Private
  async getMyTables(req, res) {
    try {
      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found. Create one first.'
        });
      }

      // Get all tables for this snooker house
      const tables = await Table.findBySnookerHouse(snookerHouse._id);

      res.json({
        success: true,
        data: {
          tables: tables.map(table => table.toJSON()),
          totalTables: tables.length,
          snookerHouse: {
            id: snookerHouse._id,
            name: snookerHouse.name
          },
          accessedBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('Get tables error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Get single table by ID
  // @access  Private (owner only)
  async getTableById(req, res) {
    try {
      const table = await Table.findById(req.params.id)
        .populate('snookerHouse', 'name address')
        .populate('owner', 'firstName lastName email');

      if (!table) {
        return res.status(404).json({
          success: false,
          message: 'Table not found'
        });
      }

      // Check if user owns this table
      if (table.owner._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own tables.'
        });
      }

      res.json({
        success: true,
        data: {
          table: table.toJSON(),
          accessedBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('Get table by ID error:', error);
      
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

  // @desc    Update table
  // @access  Private (owner only)
  async updateTable(req, res) {
    try {
      const { name, pricingMethod, hourlyRate, frameRate, kittiRate, status, description } = req.body;

      const table = await Table.findById(req.params.id);

      if (!table) {
        return res.status(404).json({
          success: false,
          message: 'Table not found'
        });
      }

      // Check if user owns this table
      if (table.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only update your own tables.'
        });
      }

      // Update basic fields if provided
      if (name) table.name = name;
      if (status) table.status = status;
      if (description !== undefined) table.description = description;

      // Handle pricing method changes
      if (pricingMethod) {
        table.pricingMethod = pricingMethod;
        
        if (pricingMethod === 'per_minute') {
          if (hourlyRate !== undefined) table.hourlyRate = hourlyRate;
          // Clear frame/kitti rates
          table.frameRate = undefined;
          table.kittiRate = undefined;
        } else if (pricingMethod === 'frame_kitti') {
          if (frameRate !== undefined) table.frameRate = frameRate;
          if (kittiRate !== undefined) table.kittiRate = kittiRate;
          // Clear hourly rate
          table.hourlyRate = undefined;
        }
      } else {
        // Update rates for existing pricing method
        if (table.pricingMethod === 'per_minute' && hourlyRate !== undefined) {
          table.hourlyRate = hourlyRate;
        } else if (table.pricingMethod === 'frame_kitti') {
          if (frameRate !== undefined) table.frameRate = frameRate;
          if (kittiRate !== undefined) table.kittiRate = kittiRate;
        }
      }

      await table.save();

      // Populate references for response
      await table.populate('snookerHouse', 'name address');

      res.json({
        success: true,
        message: 'Table updated successfully!',
        data: {
          table: table.toJSON(),
          updatedBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('Update table error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during update'
      });
    }
  }

  // @desc    Delete table
  // @access  Private (owner only)
  async deleteTable(req, res) {
    try {
      const table = await Table.findById(req.params.id);

      if (!table) {
        return res.status(404).json({
          success: false,
          message: 'Table not found'
        });
      }

      // Check if user owns this table
      if (table.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only delete your own tables.'
        });
      }

      // Check if table is currently occupied
      if (table.isOccupied) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete table while it is occupied. Please end the current booking first.'
        });
      }

      await Table.findByIdAndDelete(table._id);

      res.json({
        success: true,
        message: 'Table deleted successfully',
        data: {
          deletedBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('Delete table error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during deletion'
      });
    }
  }

  // @desc    Get all tables for a specific snooker house (public)
  // @access  Public
  async getSnookerHouseTables(req, res) {
    try {
      const { page = 1, limit = 20, status = 'active' } = req.query;
      
      const query = { 
        snookerHouse: req.params.id,
        status: status === 'all' ? { $in: ['active', 'maintenance', 'inactive'] } : status
      };

      const tables = await Table.find(query)
        .populate('snookerHouse', 'name address')
        .sort({ tableNumber: 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Table.countDocuments(query);

      res.json({
        success: true,
        data: {
          tables: tables.map(table => table.toJSON()),
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalTables: total,
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Get snooker house tables error:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid snooker house ID'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Get table statistics for user's snooker house
  // @access  Private
  async getMyTableStats(req, res) {
    try {
      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      // Get table statistics
      const totalTables = await Table.countDocuments({ snookerHouse: snookerHouse._id });
      const activeTables = await Table.countDocuments({ 
        snookerHouse: snookerHouse._id, 
        status: 'active' 
      });
      const occupiedTables = await Table.countDocuments({ 
        snookerHouse: snookerHouse._id, 
        isOccupied: true 
      });
      const maintenanceTables = await Table.countDocuments({ 
        snookerHouse: snookerHouse._id, 
        status: 'maintenance' 
      });

      // Get pricing method distribution
      const pricingStats = await Table.aggregate([
        { $match: { snookerHouse: snookerHouse._id } },
        { 
          $group: { 
            _id: '$pricingMethod', 
            count: { $sum: 1 }
          } 
        }
      ]);

      // Get average rates by pricing method
      const perMinuteTables = await Table.find({ 
        snookerHouse: snookerHouse._id, 
        pricingMethod: 'per_minute' 
      }).select('hourlyRate');

      const frameKittiTables = await Table.find({ 
        snookerHouse: snookerHouse._id, 
        pricingMethod: 'frame_kitti' 
      }).select('frameRate kittiRate');

      const stats = {
        totalTables,
        activeTables,
        occupiedTables,
        maintenanceTables,
        availableTables: activeTables - occupiedTables,
        occupancyRate: activeTables > 0 ? ((occupiedTables / activeTables) * 100).toFixed(1) : 0,
        pricingMethods: {
          per_minute: pricingStats.find(p => p._id === 'per_minute')?.count || 0,
          frame_kitti: pricingStats.find(p => p._id === 'frame_kitti')?.count || 0
        },
        averageRates: {
          perMinute: perMinuteTables.length > 0 ? 
            Math.round(perMinuteTables.reduce((sum, t) => sum + t.hourlyRate, 0) / perMinuteTables.length) : 0,
          frame: frameKittiTables.length > 0 ? 
            Math.round(frameKittiTables.reduce((sum, t) => sum + t.frameRate, 0) / frameKittiTables.length) : 0,
          kitti: frameKittiTables.length > 0 ? 
            Math.round(frameKittiTables.reduce((sum, t) => sum + t.kittiRate, 0) / frameKittiTables.length) : 0
        }
      };

      res.json({
        success: true,
        data: { 
          stats,
          accessedBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('Get table stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
}

module.exports = new TableController();