const User = require('../models/User');
const UserSession = require('../models/UserSession');

class UserController {
  // @desc    Get user profile with session info
  // @access  Private
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id).select('-password');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get session statistics
      const sessionStats = await UserSession.aggregate([
        { $match: { user: user._id } },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            activeSessions: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$isActive', true] }, { $gt: ['$expiresAt', new Date()] }] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      const stats = sessionStats[0] || { totalSessions: 0, activeSessions: 0 };

      res.json({
        success: true,
        data: { 
          user,
          currentSession: req.session,
          sessionStats: stats
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Update user profile
  // @access  Private
  async updateProfile(req, res) {
    try {
      const { firstName, lastName, profilePicture } = req.body;
      
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update fields if provided
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (profilePicture !== undefined) user.profilePicture = profilePicture;

      await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { 
          user,
          updatedBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Change user password (invalidates all other sessions)
  // @access  Private
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Invalidate all other sessions (keep current session active)
      const result = await UserSession.invalidateUserSessions(req.user.id, req.session.id);

      res.json({
        success: true,
        message: 'Password changed successfully',
        data: {
          otherSessionsLoggedOut: result.modifiedCount,
          changedBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Add/update device token for push notifications
  // @access  Private
  async addDeviceToken(req, res) {
    try {
      const { token, platform } = req.body;
      
      if (!token || !platform) {
        return res.status(400).json({
          success: false,
          message: 'Device token and platform are required'
        });
      }

      if (!['ios', 'android', 'web'].includes(platform)) {
        return res.status(400).json({
          success: false,
          message: 'Platform must be ios, android, or web'
        });
      }

      const user = await User.findById(req.user.id);
      await user.addDeviceToken(token, platform);

      res.json({
        success: true,
        message: 'Device token updated successfully',
        data: {
          platform,
          addedBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });
    } catch (error) {
      console.error('Device token error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Remove device token
  // @access  Private
  async removeDeviceToken(req, res) {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Device token is required'
        });
      }

      const user = await User.findById(req.user.id);
      const initialCount = user.deviceTokens.length;
      user.deviceTokens = user.deviceTokens.filter(dt => dt.token !== token);
      await user.save();

      const removed = initialCount - user.deviceTokens.length;

      res.json({
        success: true,
        message: 'Device token removed successfully',
        data: {
          tokensRemoved: removed,
          removedBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });
    } catch (error) {
      console.error('Remove device token error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Get user statistics including session data
  // @access  Private
  async getStats(req, res) {
    try {
      const user = await User.findById(req.user.id);
      
      // Get session statistics
      const sessionStats = await UserSession.aggregate([
        { $match: { user: user._id } },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            activeSessions: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$isActive', true] }, { $gt: ['$expiresAt', new Date()] }] },
                  1,
                  0
                ]
              }
            },
            rememberMeSessions: {
              $sum: {
                $cond: ['$rememberMe', 1, 0]
              }
            }
          }
        }
      ]);

      // Get device statistics
      const deviceStats = await UserSession.aggregate([
        { $match: { user: user._id, isActive: true, expiresAt: { $gt: new Date() } } },
        {
          $group: {
            _id: '$deviceInfo.platform',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get recent activity
      const recentSessions = await UserSession.find({
        user: user._id,
        lastActivity: { $gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }).sort({ lastActivity: -1 }).limit(5).select('deviceInfo lastActivity createdAt');

      const stats = {
        account: {
          accountCreated: user.createdAt,
          lastLogin: user.lastLogin,
          emailVerified: user.isEmailVerified,
          profileComplete: !!(user.firstName && user.lastName && user.profilePicture)
        },
        sessions: sessionStats[0] || { totalSessions: 0, activeSessions: 0, rememberMeSessions: 0 },
        devices: {
          active: deviceStats.length,
          breakdown: deviceStats.reduce((acc, device) => {
            acc[device._id || 'unknown'] = device.count;
            return acc;
          }, {}),
          pushTokens: user.deviceTokens.length
        },
        recentActivity: recentSessions,
        currentSession: req.session
      };

      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Get user's sessions
  // @access  Private
  async getSessions(req, res) {
    try {
      const sessions = await UserSession.getUserSessions(req.user.id);
      
      const sessionsWithCurrent = sessions.map(session => ({
        ...session.toJSON(),
        isCurrent: session.sessionId === req.session.id
      }));

      res.json({
        success: true,
        data: {
          sessions: sessionsWithCurrent,
          currentSessionId: req.session.id,
          total: sessionsWithCurrent.length
        }
      });
    } catch (error) {
      console.error('Get user sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Delete user account (with all sessions and data)
  // @access  Private
  async deleteAccount(req, res) {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to delete account'
        });
      }

      const user = await User.findById(req.user.id);
      
      // Verify password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Incorrect password'
        });
      }

      // Delete all user sessions
      const sessionResult = await UserSession.deleteMany({ user: req.user.id });
      
      // Delete user account
      await User.findByIdAndDelete(req.user.id);

      res.json({
        success: true,
        message: 'Account deleted successfully',
        data: {
          sessionsDeleted: sessionResult.deletedCount,
          deletedBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Logout specific device/session
  // @access  Private
  async logoutDevice(req, res) {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required'
        });
      }

      // Verify session belongs to user
      const session = await UserSession.findOne({ 
        sessionId, 
        user: req.user.id,
        isActive: true 
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found or already inactive'
        });
      }

      // Invalidate the session
      await UserSession.invalidateSession(sessionId);
      
      res.json({
        success: true,
        message: 'Device logged out successfully',
        data: {
          loggedOutSessionId: sessionId,
          deviceInfo: session.deviceInfo,
          actionBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo
          }
        }
      });
    } catch (error) {
      console.error('Logout device error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Get user security information
  // @access  Private
  async getSecurityInfo(req, res) {
    try {
      const user = await User.findById(req.user.id).select('lastLogin isEmailVerified otpAttempts accountLocked lockUntil createdAt');
      
      // Get session security info
      const sessionStats = await UserSession.aggregate([
        { $match: { user: user._id } },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            activeSessions: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$isActive', true] }, { $gt: ['$expiresAt', new Date()] }] },
                  1,
                  0
                ]
              }
            },
            oldestActiveSession: {
              $min: {
                $cond: [
                  { $and: [{ $eq: ['$isActive', true] }, { $gt: ['$expiresAt', new Date()] }] },
                  '$createdAt',
                  null
                ]
              }
            },
            newestActiveSession: {
              $max: {
                $cond: [
                  { $and: [{ $eq: ['$isActive', true] }, { $gt: ['$expiresAt', new Date()] }] },
                  '$createdAt',
                  null
                ]
              }
            }
          }
        }
      ]);

      // Get unique IP addresses from recent sessions
      const recentIPs = await UserSession.distinct('deviceInfo.ip', {
        user: user._id,
        createdAt: { $gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });

      const securityInfo = {
        account: {
          emailVerified: user.isEmailVerified,
          accountLocked: user.accountLocked,
          lockUntil: user.lockUntil,
          failedAttempts: user.otpAttempts,
          accountAge: Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24)), // days
          lastLogin: user.lastLogin
        },
        sessions: sessionStats[0] || { 
          totalSessions: 0, 
          activeSessions: 0, 
          oldestActiveSession: null, 
          newestActiveSession: null 
        },
        security: {
          uniqueIPsLast30Days: recentIPs.length,
          deviceTokensRegistered: user.deviceTokens?.length || 0,
          currentSession: {
            id: req.session.id,
            createdAt: req.session.createdAt,
            lastActivity: req.session.lastActivity,
            deviceInfo: req.session.deviceInfo
          }
        },
        recommendations: []
      };

      // Add security recommendations
      if (!user.isEmailVerified) {
        securityInfo.recommendations.push('Verify your email address for better security');
      }
      
      if (securityInfo.sessions.activeSessions > 5) {
        securityInfo.recommendations.push('You have many active sessions. Consider logging out unused devices');
      }
      
      if (securityInfo.security.uniqueIPsLast30Days > 10) {
        securityInfo.recommendations.push('Your account has been accessed from many different locations recently');
      }

      res.json({
        success: true,
        data: { securityInfo }
      });
    } catch (error) {
      console.error('Get security info error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  // @desc    Logout all other sessions (security action)
  // @access  Private
  async securityLogoutAllOthers(req, res) {
    try {
      const result = await UserSession.invalidateUserSessions(req.user.id, req.session.id);
      
      res.json({
        success: true,
        message: `Successfully logged out ${result.modifiedCount} other sessions for security`,
        data: {
          loggedOutCount: result.modifiedCount,
          actionBy: {
            sessionId: req.session.id,
            deviceInfo: req.session.deviceInfo,
            timestamp: new Date()
          }
        }
      });
    } catch (error) {
      console.error('Security logout others error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
}

module.exports = new UserController();