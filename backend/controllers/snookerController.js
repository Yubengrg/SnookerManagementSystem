const SnookerHouse = require('../models/SnookerHouse');

class SnookerController {
  // @desc    Create a new snooker house
  // @access  Private (logged-in users only)
  async createSnookerHouse(req, res) {
    try {
      const { name, profilePicture, address } = req.body;

      // Check if user already has a snooker house
      const existingHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (existingHouse) {
        return res.status(400).json({
          success: false,
          message: 'You already have a snooker house created. You can update your existing one.'
        });
      }

      // Create new snooker house
      const snookerHouse = new SnookerHouse({
        name,
        profilePicture,
        address,
        owner: req.user.id
      });

      await snookerHouse.save();

      // Populate owner info for response
      await snookerHouse.populate('owner', 'firstName lastName email');

      res.status(201).json({
        success: true,
        message: 'Snooker house created successfully!',
        data: {
          snookerHouse: snookerHouse.toJSON(),
          createdBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('Snooker house creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during snooker house creation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // @desc    Get user's snooker house
  // @access  Private
  async getMySnookerHouse(req, res) {
    try {
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id })
        .populate('owner', 'firstName lastName email');

      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found. Create one first.'
        });
      }

      res.json({
        success: true,
        data: {
          snookerHouse: snookerHouse.toJSON(),
          accessedBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('Get snooker house error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Update user's snooker house
  // @access  Private
  async updateMySnookerHouse(req, res) {
    try {
      const { name, profilePicture, address } = req.body;

      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });

      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found. Create one first.'
        });
      }

      // Update fields if provided
      if (name) snookerHouse.name = name;
      if (profilePicture !== undefined) snookerHouse.profilePicture = profilePicture;
      if (address) snookerHouse.address = address;

      await snookerHouse.save();

      // Populate owner info for response
      await snookerHouse.populate('owner', 'firstName lastName email');

      res.json({
        success: true,
        message: 'Snooker house updated successfully!',
        data: {
          snookerHouse: snookerHouse.toJSON(),
          updatedBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('Update snooker house error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during update'
      });
    }
  }

  // @desc    Delete user's snooker house
  // @access  Private
  async deleteMySnookerHouse(req, res) {
    try {
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });

      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      await SnookerHouse.findByIdAndDelete(snookerHouse._id);

      res.json({
        success: true,
        message: 'Snooker house deleted successfully',
        data: {
          deletedBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('Delete snooker house error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during deletion'
      });
    }
  }

  // @desc    Get all snooker houses (public)
  // @access  Public
  async getAllSnookerHouses(req, res) {
    try {
      const { page = 1, limit = 20, search } = req.query;
      
      const query = {};
      
      // Add search functionality
      if (search) {
        query.$or = [
          { name: new RegExp(search, 'i') },
          { address: new RegExp(search, 'i') }
        ];
      }

      const snookerHouses = await SnookerHouse.find(query)
        .populate('owner', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await SnookerHouse.countDocuments(query);

      res.json({
        success: true,
        data: {
          snookerHouses: snookerHouses.map(house => house.toJSON()),
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalHouses: total,
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Get all snooker houses error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Get single snooker house by ID
  // @access  Public
  async getSnookerHouseById(req, res) {
    try {
      const snookerHouse = await SnookerHouse.findById(req.params.id)
        .populate('owner', 'firstName lastName email');

      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'Snooker house not found'
        });
      }

      res.json({
        success: true,
        data: {
          snookerHouse: snookerHouse.toJSON()
        }
      });

    } catch (error) {
      console.error('Get snooker house by ID error:', error);
      
      // Handle invalid ObjectId
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

  // @desc    Get snooker house statistics
  // @access  Public
  async getSnookerHouseStats(req, res) {
    try {
      const totalHouses = await SnookerHouse.countDocuments();
      const recentHouses = await SnookerHouse.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      });

      res.json({
        success: true,
        data: {
          stats: {
            totalHouses,
            recentHouses,
            lastUpdated: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
}

module.exports = new SnookerController();