const Session = require('../models/Session');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Table = require('../models/Table');
const SnookerHouse = require('../models/SnookerHouse');
const mongoose = require('mongoose'); // 🔧 ADD THIS IMPORT

class BusinessAnalyticsController {
  // @desc    Get comprehensive business dashboard
  // @access  Private
  async getDashboard(req, res) {
    try {
      console.log('📊 Getting business dashboard for user:', req.user?.id);

      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      // 🔧 CRITICAL FIX: Convert snookerHouseId to ObjectId for aggregations
      const snookerHouseObjectId = new mongoose.Types.ObjectId(snookerHouse._id);

      // Get date ranges
      const now = new Date();
      const today = {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      };
      
      const thisWeek = {
        start: new Date(now.setDate(now.getDate() - now.getDay())),
        end: new Date()
      };

      const thisMonth = {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date()
      };

      const lastMonth = {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0)
      };

      // 🔧 FIX: Use proper method binding by calling methods on the instance
      // Parallel execution for better performance
      const [
        revenueMetrics,
        sessionMetrics,
        inventoryMetrics,
        tableMetrics,
        customerMetrics,
        trendData
      ] = await Promise.all([
        this.getRevenueMetrics(snookerHouseObjectId, today, thisWeek, thisMonth, lastMonth),
        this.getSessionMetrics(snookerHouseObjectId, today, thisWeek, thisMonth),
        this.getInventoryMetrics(snookerHouseObjectId),
        this.getTableMetrics(snookerHouseObjectId),
        this.getCustomerMetrics(snookerHouseObjectId, thisMonth),
        this.getTrendData(snookerHouseObjectId, 30) // Last 30 days
      ]);

      const dashboard = {
        overview: {
          totalRevenue: revenueMetrics.total,
          todayRevenue: revenueMetrics.today,
          monthlyGrowth: revenueMetrics.monthlyGrowth,
          totalSessions: sessionMetrics.total,
          activeSessions: sessionMetrics.active,
          totalCustomers: customerMetrics.total,
          averageSessionValue: revenueMetrics.averageSessionValue
        },
        revenue: revenueMetrics,
        sessions: sessionMetrics,
        inventory: inventoryMetrics,
        tables: tableMetrics,
        customers: customerMetrics,
        trends: trendData,
        insights: await this.generateInsights(snookerHouseObjectId, revenueMetrics, sessionMetrics, inventoryMetrics)
      };

      console.log('✅ Business dashboard generated successfully');

      res.json({
        success: true,
        data: {
          dashboard,
          snookerHouse: {
            id: snookerHouse._id,
            name: snookerHouse.name
          },
          generatedAt: new Date(),
          accessedBy: {
            sessionId: req.session?.id,
            deviceInfo: req.session?.deviceInfo
          }
        }
      });

    } catch (error) {
      console.error('💥 Get dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while generating dashboard'
      });
    }
  }

  // 🔧 FIXED: Revenue Analytics with proper ObjectId casting
  async getRevenueMetrics(snookerHouseObjectId, today, thisWeek, thisMonth, lastMonth) {
    const [
      totalRevenue,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      lastMonthRevenue,
      revenueBreakdown,
      paymentMethodStats
    ] = await Promise.all([
      // Total all-time revenue
      Session.aggregate([
        { $match: { snookerHouse: snookerHouseObjectId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalCost' } } }
      ]),
      
      // Today's revenue
      Session.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouseObjectId, 
            status: 'completed',
            endTime: { $gte: today.start, $lte: today.end }
          } 
        },
        { 
          $group: { 
            _id: null, 
            total: { $sum: '$totalCost' },
            sessions: { $sum: 1 },
            gameRevenue: { $sum: '$gameCost' },
            itemsRevenue: { $sum: '$totalItemsRevenue' }
          } 
        }
      ]),

      // This week's revenue
      Session.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouseObjectId, 
            status: 'completed',
            endTime: { $gte: thisWeek.start, $lte: thisWeek.end }
          } 
        },
        { $group: { _id: null, total: { $sum: '$totalCost' } } }
      ]),

      // This month's revenue
      Session.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouseObjectId, 
            status: 'completed',
            endTime: { $gte: thisMonth.start, $lte: thisMonth.end }
          } 
        },
        { $group: { _id: null, total: { $sum: '$totalCost' } } }
      ]),

      // Last month's revenue
      Session.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouseObjectId, 
            status: 'completed',
            endTime: { $gte: lastMonth.start, $lte: lastMonth.end }
          } 
        },
        { $group: { _id: null, total: { $sum: '$totalCost' } } }
      ]),

      // Revenue breakdown (games vs items)
      Session.aggregate([
        { $match: { snookerHouse: snookerHouseObjectId, status: 'completed' } },
        {
          $group: {
            _id: null,
            totalGameRevenue: { $sum: '$gameCost' },
            totalItemsRevenue: { $sum: '$totalItemsRevenue' },
            totalItemsProfit: { $sum: '$totalItemsProfit' }
          }
        }
      ]),

      // Payment method statistics
      Session.aggregate([
        { $match: { snookerHouse: snookerHouseObjectId, status: 'completed', paymentStatus: 'paid' } },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            amount: { $sum: '$totalPaidAmount' }
          }
        }
      ])
    ]);

    const thisMonthTotal = monthRevenue[0]?.total || 0;
    const lastMonthTotal = lastMonthRevenue[0]?.total || 0;
    const monthlyGrowth = lastMonthTotal > 0 ? 
      ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100) : 0;

    const breakdown = revenueBreakdown[0] || { 
      totalGameRevenue: 0, 
      totalItemsRevenue: 0, 
      totalItemsProfit: 0 
    };

    return {
      total: Math.round(totalRevenue[0]?.total || 0),
      today: Math.round(todayRevenue[0]?.total || 0),
      week: Math.round(weekRevenue[0]?.total || 0),
      month: Math.round(thisMonthTotal),
      lastMonth: Math.round(lastMonthTotal),
      monthlyGrowth: Math.round(monthlyGrowth * 100) / 100,
      averageSessionValue: todayRevenue[0]?.sessions > 0 ? 
        Math.round((todayRevenue[0]?.total || 0) / todayRevenue[0].sessions) : 0,
      breakdown: {
        gameRevenue: Math.round(breakdown.totalGameRevenue),
        itemsRevenue: Math.round(breakdown.totalItemsRevenue),
        itemsProfit: Math.round(breakdown.totalItemsProfit),
        gamePercentage: breakdown.totalGameRevenue + breakdown.totalItemsRevenue > 0 ?
          Math.round((breakdown.totalGameRevenue / (breakdown.totalGameRevenue + breakdown.totalItemsRevenue)) * 100) : 0
      },
      todayBreakdown: {
        gameRevenue: Math.round(todayRevenue[0]?.gameRevenue || 0),
        itemsRevenue: Math.round(todayRevenue[0]?.itemsRevenue || 0)
      },
      paymentMethods: paymentMethodStats.map(method => ({
        method: method._id,
        count: method.count,
        amount: Math.round(method.amount)
      }))
    };
  }

  // 🔧 FIXED: Session Analytics with proper ObjectId casting
  async getSessionMetrics(snookerHouseObjectId, today, thisWeek, thisMonth) {
    const [
      totalSessions,
      activeSessions,
      todaySessions,
      weekSessions,
      monthSessions,
      avgDuration,
      peakHours,
      sessionsByStatus
    ] = await Promise.all([
      Session.countDocuments({ snookerHouse: snookerHouseObjectId }),
      Session.countDocuments({ snookerHouse: snookerHouseObjectId, status: { $in: ['active', 'paused'] } }),
      Session.countDocuments({ 
        snookerHouse: snookerHouseObjectId, 
        createdAt: { $gte: today.start, $lte: today.end }
      }),
      Session.countDocuments({ 
        snookerHouse: snookerHouseObjectId, 
        createdAt: { $gte: thisWeek.start, $lte: thisWeek.end }
      }),
      Session.countDocuments({ 
        snookerHouse: snookerHouseObjectId, 
        createdAt: { $gte: thisMonth.start, $lte: thisMonth.end }
      }),
      
      // Average session duration
      Session.aggregate([
        { $match: { snookerHouse: snookerHouseObjectId, status: 'completed', endTime: { $exists: true } } },
        {
          $project: {
            duration: {
              $subtract: ['$endTime', '$startTime']
            }
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$duration' }
          }
        }
      ]),

      // Peak hours analysis
      Session.aggregate([
        { $match: { snookerHouse: snookerHouseObjectId, status: 'completed' } },
        {
          $group: {
            _id: { $hour: '$startTime' },
            count: { $sum: 1 },
            avgRevenue: { $avg: '$totalCost' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),

      // Sessions by status
      Session.aggregate([
        { $match: { snookerHouse: snookerHouseObjectId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Get payment breakdown
    const paymentBreakdown = await Session.aggregate([
      { $match: { snookerHouse: snookerHouseObjectId } },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const paymentStats = paymentBreakdown.reduce((acc, status) => {
      acc[status._id] = status.count;
      return acc;
    }, { paid: 0, credit: 0, pending: 0 });

    return {
      total: totalSessions,
      active: activeSessions,
      today: todaySessions,
      week: weekSessions,
      month: monthSessions,
      averageDuration: avgDuration[0] ? Math.round(avgDuration[0].avgDuration / (1000 * 60)) : 0, // minutes
      peakHours: peakHours.map(hour => ({
        hour: hour._id,
        sessions: hour.count,
        avgRevenue: Math.round(hour.avgRevenue)
      })),
      statusBreakdown: sessionsByStatus.reduce((acc, status) => {
        acc[status._id] = status.count;
        return acc;
      }, {}),
      paymentBreakdown: paymentStats
    };
  }

  // 🔧 FIXED: Inventory Analytics with proper ObjectId casting
  async getInventoryMetrics(snookerHouseObjectId) {
    const [
      totalProducts,
      lowStockProducts,
      inventoryValue,
      categoryBreakdown,
      topSellingProducts,
      inventoryTurnover
    ] = await Promise.all([
      Product.countDocuments({ snookerHouse: snookerHouseObjectId }),
      
      Product.countDocuments({
        snookerHouse: snookerHouseObjectId,
        $expr: { $lte: ['$currentStock', '$minStockLevel'] }
      }),

      Product.aggregate([
        { $match: { snookerHouse: snookerHouseObjectId } },
        {
          $group: {
            _id: null,
            totalValue: { $sum: { $multiply: ['$currentStock', '$costPrice'] } },
            potentialRevenue: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } },
            totalItems: { $sum: '$currentStock' }
          }
        }
      ]),

      Product.aggregate([
        { $match: { snookerHouse: snookerHouseObjectId } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalStock: { $sum: '$currentStock' },
            totalValue: { $sum: { $multiply: ['$currentStock', '$costPrice'] } }
          }
        }
      ]),

      // Top selling products from sales data
      Sale.aggregate([
        { $match: { snookerHouse: snookerHouseObjectId } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productName',
            totalSold: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.totalRevenue' },
            totalProfit: { $sum: '$items.profit' }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]),

      // Inventory turnover (simplified)
      Sale.aggregate([
        { $match: { snookerHouse: snookerHouseObjectId } },
        { $unwind: '$items' },
        {
          $group: {
            _id: null,
            totalItemsSold: { $sum: '$items.quantity' },
            totalItemsRevenue: { $sum: '$items.totalRevenue' }
          }
        }
      ])
    ]);

    const inventoryStats = inventoryValue[0] || { totalValue: 0, potentialRevenue: 0, totalItems: 0 };
    const turnoverStats = inventoryTurnover[0] || { totalItemsSold: 0, totalItemsRevenue: 0 };

    return {
      totalProducts,
      lowStockProducts,
      totalInventoryValue: Math.round(inventoryStats.totalValue),
      potentialRevenue: Math.round(inventoryStats.potentialRevenue),
      totalItems: inventoryStats.totalItems,
      potentialProfit: Math.round(inventoryStats.potentialRevenue - inventoryStats.totalValue),
      categoryBreakdown: categoryBreakdown.map(cat => ({
        category: cat._id,
        productCount: cat.count,
        totalStock: cat.totalStock,
        totalValue: Math.round(cat.totalValue)
      })),
      topSellingProducts: topSellingProducts.map(product => ({
        name: product._id,
        totalSold: product.totalSold,
        totalRevenue: Math.round(product.totalRevenue),
        totalProfit: Math.round(product.totalProfit)
      })),
      turnover: {
        totalItemsSold: turnoverStats.totalItemsSold,
        totalItemsRevenue: Math.round(turnoverStats.totalItemsRevenue)
      }
    };
  }

  // 🔧 FIXED: Table Analytics with proper ObjectId casting
  async getTableMetrics(snookerHouseObjectId) {
    const [
      totalTables,
      activeTables,
      occupiedTables,
      tableUtilization,
      revenueByTable
    ] = await Promise.all([
      Table.countDocuments({ snookerHouse: snookerHouseObjectId }),
      Table.countDocuments({ snookerHouse: snookerHouseObjectId, status: 'active' }),
      Table.countDocuments({ snookerHouse: snookerHouseObjectId, isOccupied: true }),

      // Table utilization (sessions per table)
      Session.aggregate([
        { $match: { snookerHouse: snookerHouseObjectId } },
        {
          $lookup: {
            from: 'tables',
            localField: 'table',
            foreignField: '_id',
            as: 'tableInfo'
          }
        },
        { $unwind: '$tableInfo' },
        {
          $group: {
            _id: '$table',
            tableName: { $first: '$tableInfo.name' },
            tableNumber: { $first: '$tableInfo.tableNumber' },
            totalSessions: { $sum: 1 },
            totalRevenue: { $sum: '$totalCost' },
            avgSessionDuration: { $avg: { $subtract: ['$endTime', '$startTime'] } }
          }
        },
        { $sort: { totalSessions: -1 } }
      ]),

      // Revenue by table for this month
      Session.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouseObjectId, 
            status: 'completed',
            endTime: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
          } 
        },
        {
          $lookup: {
            from: 'tables',
            localField: 'table',
            foreignField: '_id',
            as: 'tableInfo'
          }
        },
        { $unwind: '$tableInfo' },
        {
          $group: {
            _id: '$table',
            tableName: { $first: '$tableInfo.name' },
            monthlyRevenue: { $sum: '$totalCost' },
            monthlySessions: { $sum: 1 }
          }
        },
        { $sort: { monthlyRevenue: -1 } }
      ])
    ]);

    return {
      totalTables,
      activeTables,
      occupiedTables,
      occupancyRate: activeTables > 0 ? Math.round((occupiedTables / activeTables) * 100) : 0,
      utilization: tableUtilization.map(table => ({
        tableId: table._id,
        tableName: table.tableName,
        tableNumber: table.tableNumber,
        totalSessions: table.totalSessions,
        totalRevenue: Math.round(table.totalRevenue),
        avgDuration: table.avgSessionDuration ? Math.round(table.avgSessionDuration / (1000 * 60)) : 0
      })),
      monthlyPerformance: revenueByTable.map(table => ({
        tableId: table._id,
        tableName: table.tableName,
        monthlyRevenue: Math.round(table.monthlyRevenue),
        monthlySessions: table.monthlySessions
      }))
    };
  }

  // 🔧 FIXED: Customer Analytics with proper ObjectId casting
  async getCustomerMetrics(snookerHouseObjectId, thisMonth) {
    const [
      totalCustomers,
      returningCustomers,
      topCustomers
    ] = await Promise.all([
      Session.distinct('customerName', { 
        snookerHouse: snookerHouseObjectId,
        customerName: { $ne: 'Guest' }
      }),

      Session.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouseObjectId,
            customerName: { $ne: 'Guest' },
            createdAt: { $gte: thisMonth.start, $lte: thisMonth.end }
          } 
        },
        {
          $group: {
            _id: '$customerName',
            sessionCount: { $sum: 1 }
          }
        },
        { $match: { sessionCount: { $gte: 2 } } }
      ]),

      Session.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouseObjectId,
            status: 'completed',
            customerName: { $ne: 'Guest' }
          } 
        },
        {
          $group: {
            _id: '$customerName',
            totalSessions: { $sum: 1 },
            totalSpent: { $sum: '$totalCost' },
            avgSpent: { $avg: '$totalCost' },
            lastVisit: { $max: '$endTime' }
          }
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 }
      ])
    ]);

    return {
      total: totalCustomers.length,
      returning: returningCustomers.length,
      newThisMonth: totalCustomers.length - returningCustomers.length,
      topCustomers: topCustomers.map(customer => ({
        name: customer._id,
        totalSessions: customer.totalSessions,
        totalSpent: Math.round(customer.totalSpent),
        avgSpent: Math.round(customer.avgSpent),
        lastVisit: customer.lastVisit
      }))
    };
  }

  // 🔧 FIXED: Trend Data with proper ObjectId casting
  async getTrendData(snookerHouseObjectId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [dailyRevenue, hourlySessions] = await Promise.all([
      Session.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouseObjectId, 
            status: 'completed',
            endTime: { $gte: startDate }
          } 
        },
        {
          $group: {
            _id: {
              year: { $year: '$endTime' },
              month: { $month: '$endTime' },
              day: { $dayOfMonth: '$endTime' }
            },
            revenue: { $sum: '$totalCost' },
            sessions: { $sum: 1 },
            gameRevenue: { $sum: '$gameCost' },
            itemsRevenue: { $sum: '$totalItemsRevenue' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]),

      Session.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouseObjectId,
            createdAt: { $gte: startDate }
          } 
        },
        {
          $group: {
            _id: { $hour: '$startTime' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    return {
      dailyRevenue: dailyRevenue.map(day => ({
        date: `${day._id.year}-${String(day._id.month).padStart(2, '0')}-${String(day._id.day).padStart(2, '0')}`,
        revenue: Math.round(day.revenue),
        sessions: day.sessions,
        gameRevenue: Math.round(day.gameRevenue),
        itemsRevenue: Math.round(day.itemsRevenue)
      })),
      hourlySessions: Array.from({ length: 24 }, (_, hour) => {
        const hourData = hourlySessions.find(h => h._id === hour);
        return {
          hour,
          sessions: hourData ? hourData.count : 0
        };
      })
    };
  }

  // 🔧 FIXED: Generate Business Insights with proper ObjectId casting
  async generateInsights(snookerHouseObjectId, revenue, sessions, inventory) {
    const insights = [];

    // Revenue insights
    if (revenue.monthlyGrowth > 10) {
      insights.push({
        type: 'positive',
        category: 'revenue',
        title: 'Strong Growth',
        message: `Revenue increased by ${revenue.monthlyGrowth}% this month`,
        priority: 'high'
      });
    } else if (revenue.monthlyGrowth < -10) {
      insights.push({
        type: 'warning',
        category: 'revenue',
        title: 'Revenue Decline',
        message: `Revenue decreased by ${Math.abs(revenue.monthlyGrowth)}% this month`,
        priority: 'high'
      });
    }

    // Inventory insights
    if (inventory.lowStockProducts > 0) {
      insights.push({
        type: 'warning',
        category: 'inventory',
        title: 'Low Stock Alert',
        message: `${inventory.lowStockProducts} products are running low on stock`,
        priority: 'medium'
      });
    }

    // Session insights
    if (sessions.averageDuration < 30) {
      insights.push({
        type: 'info',
        category: 'sessions',
        title: 'Short Sessions',
        message: `Average session duration is ${sessions.averageDuration} minutes`,
        priority: 'low'
      });
    }

    // Peak hours insight
    if (sessions.peakHours.length > 0) {
      const peakHour = sessions.peakHours[0];
      insights.push({
        type: 'info',
        category: 'operations',
        title: 'Peak Hours',
        message: `Most busy hour is ${peakHour.hour}:00 with ${peakHour.sessions} sessions`,
        priority: 'low'
      });
    }

    return insights;
  }

  // @desc    Get financial reports
  // @access  Private
  async getFinancialReport(req, res) {
    try {
      const { period = 'month', startDate, endDate } = req.query;
      
      // Find user's snooker house
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      // Calculate date range
      let dateRange = {};
      const now = new Date();
      
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate),
          end: new Date(endDate)
        };
      } else {
        switch (period) {
          case 'today':
            dateRange = {
              start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
              end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
            };
            break;
          case 'week':
            dateRange = {
              start: new Date(now.setDate(now.getDate() - now.getDay())),
              end: new Date()
            };
            break;
          case 'month':
            dateRange = {
              start: new Date(now.getFullYear(), now.getMonth(), 1),
              end: new Date()
            };
            break;
          case 'year':
            dateRange = {
              start: new Date(now.getFullYear(), 0, 1),
              end: new Date()
            };
            break;
        }
      }

      const [
        revenueData,
        expenseData,
        profitAnalysis,
        cashFlow
      ] = await Promise.all([
        this.getDetailedRevenueData(snookerHouse._id, dateRange),
        this.getExpenseData(snookerHouse._id, dateRange),
        this.getProfitAnalysis(snookerHouse._id, dateRange),
        this.getCashFlowData(snookerHouse._id, dateRange)
      ]);

      const report = {
        period,
        dateRange,
        revenue: revenueData,
        expenses: expenseData,
        profit: profitAnalysis,
        cashFlow: cashFlow,
        summary: {
          totalRevenue: revenueData.total,
          totalExpenses: expenseData.total,
          netProfit: revenueData.total - expenseData.total,
          profitMargin: revenueData.total > 0 ? 
            Math.round(((revenueData.total - expenseData.total) / revenueData.total) * 100) : 0
        }
      };

      res.json({
        success: true,
        data: {
          report,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('💥 Financial report error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while generating financial report'
      });
    }
  }

  // Helper methods for financial reports
  async getDetailedRevenueData(snookerHouseId, dateRange) {
    const revenueData = await Session.aggregate([
      { 
        $match: { 
          snookerHouse: snookerHouseId, 
          status: 'completed',
          endTime: { $gte: dateRange.start, $lte: dateRange.end }
        } 
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalCost' },
          gameRevenue: { $sum: '$gameCost' },
          itemsRevenue: { $sum: '$totalItemsRevenue' },
          itemsProfit: { $sum: '$totalItemsProfit' },
          sessionsCount: { $sum: 1 }
        }
      }
    ]);

    const data = revenueData[0] || { 
      total: 0, gameRevenue: 0, itemsRevenue: 0, itemsProfit: 0, sessionsCount: 0 
    };

    return {
      total: Math.round(data.total),
      gameRevenue: Math.round(data.gameRevenue),
      itemsRevenue: Math.round(data.itemsRevenue),
      itemsProfit: Math.round(data.itemsProfit),
      sessionsCount: data.sessionsCount,
      averagePerSession: data.sessionsCount > 0 ? Math.round(data.total / data.sessionsCount) : 0
    };
  }

  async getExpenseData(snookerHouseId, dateRange) {
    // For now, we'll calculate inventory costs as expenses
    // You can expand this to include other operational expenses
    const inventoryExpenses = await Sale.aggregate([
      { 
        $match: { 
          snookerHouse: snookerHouseId,
          saleDate: { $gte: dateRange.start, $lte: dateRange.end }
        } 
      },
      {
        $group: {
          _id: null,
          totalCost: { $sum: '$totalCost' }
        }
      }
    ]);

    return {
      total: Math.round(inventoryExpenses[0]?.totalCost || 0),
      inventory: Math.round(inventoryExpenses[0]?.totalCost || 0),
      // Add other expense categories as needed
      operational: 0,
      maintenance: 0
    };
  }

  async getProfitAnalysis(snookerHouseId, dateRange) {
    const [sessionProfit, inventoryProfit] = await Promise.all([
      Session.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouseId, 
            status: 'completed',
            endTime: { $gte: dateRange.start, $lte: dateRange.end }
          } 
        },
        {
          $group: {
            _id: null,
            gameProfit: { $sum: '$gameCost' }, // Game sessions are pure profit
            itemsProfit: { $sum: '$totalItemsProfit' }
          }
        }
      ]),

      Sale.aggregate([
        { 
          $match: { 
            snookerHouse: snookerHouseId,
            saleDate: { $gte: dateRange.start, $lte: dateRange.end }
          } 
        },
        {
          $group: {
            _id: null,
            totalProfit: { $sum: '$totalProfit' }
          }
        }
      ])
    ]);

    const sessionData = sessionProfit[0] || { gameProfit: 0, itemsProfit: 0 };
    const inventoryData = inventoryProfit[0] || { totalProfit: 0 };

    return {
      gameProfit: Math.round(sessionData.gameProfit),
      itemsProfit: Math.round(sessionData.itemsProfit + inventoryData.totalProfit),
      totalProfit: Math.round(sessionData.gameProfit + sessionData.itemsProfit + inventoryData.totalProfit)
    };
  }

  async getCashFlowData(snookerHouseId, dateRange) {
    const cashFlow = await Session.aggregate([
      { 
        $match: { 
          snookerHouse: snookerHouseId, 
          status: 'completed',
          endTime: { $gte: dateRange.start, $lte: dateRange.end }
        } 
      },
      {
        $group: {
          _id: '$paymentStatus',
          amount: { $sum: '$totalCost' },
          count: { $sum: 1 }
        }
      }
    ]);

    return cashFlow.reduce((acc, flow) => {
      acc[flow._id] = {
        amount: Math.round(flow.amount),
        count: flow.count
      };
      return acc;
    }, { paid: { amount: 0, count: 0 }, credit: { amount: 0, count: 0 }, pending: { amount: 0, count: 0 } });
  }

  // @desc    Get customer analytics
  // @access  Private
  async getCustomerAnalytics(req, res) {
    try {
      const snookerHouse = await SnookerHouse.findOne({ owner: req.user.id });
      if (!snookerHouse) {
        return res.status(404).json({
          success: false,
          message: 'No snooker house found'
        });
      }

      const [
        customerSegmentation,
        customerLifetime,
        frequencyAnalysis,
        sessionPatterns
      ] = await Promise.all([
        this.getCustomerSegmentation(snookerHouse._id),
        this.getCustomerLifetimeValue(snookerHouse._id),
        this.getCustomerFrequencyAnalysis(snookerHouse._id),
        this.getCustomerSessionPatterns(snookerHouse._id)
      ]);

      res.json({
        success: true,
        data: {
          segmentation: customerSegmentation,
          lifetime: customerLifetime,
          frequency: frequencyAnalysis,
          patterns: sessionPatterns,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('💥 Customer analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while generating customer analytics'
      });
    }
  }

  async getCustomerSegmentation(snookerHouseId) {
    const segments = await Session.aggregate([
      { 
        $match: { 
          snookerHouse: snookerHouseId, 
          status: 'completed',
          customerName: { $ne: 'Guest' }
        } 
      },
      {
        $group: {
          _id: '$customerName',
          totalSpent: { $sum: '$totalCost' },
          sessionCount: { $sum: 1 },
          avgSpent: { $avg: '$totalCost' },
          firstVisit: { $min: '$startTime' },
          lastVisit: { $max: '$endTime' }
        }
      },
      {
        $addFields: {
          segment: {
            $switch: {
              branches: [
                { case: { $gte: ['$totalSpent', 10000] }, then: 'VIP' },
                { case: { $gte: ['$totalSpent', 5000] }, then: 'Premium' },
                { case: { $gte: ['$totalSpent', 2000] }, then: 'Regular' },
                { case: { $gte: ['$sessionCount', 5] }, then: 'Frequent' }
              ],
              default: 'New'
            }
          }
        }
      },
      {
        $group: {
          _id: '$segment',
          count: { $sum: 1 },
          avgSpent: { $avg: '$totalSpent' },
          avgSessions: { $avg: '$sessionCount' }
        }
      }
    ]);

    return segments.map(segment => ({
      segment: segment._id,
      count: segment.count,
      avgSpent: Math.round(segment.avgSpent),
      avgSessions: Math.round(segment.avgSessions)
    }));
  }

  async getCustomerLifetimeValue(snookerHouseId) {
    return await Session.aggregate([
      { 
        $match: { 
          snookerHouse: snookerHouseId, 
          status: 'completed',
          customerName: { $ne: 'Guest' }
        } 
      },
      {
        $group: {
          _id: '$customerName',
          totalSpent: { $sum: '$totalCost' },
          sessionCount: { $sum: 1 },
          daysSinceFirst: {
            $divide: [
              { $subtract: [new Date(), { $min: '$startTime' }] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $addFields: {
          avgSpentPerVisit: { $divide: ['$totalSpent', '$sessionCount'] },
          estimatedLifetimeValue: {
            $multiply: [
              { $divide: ['$totalSpent', '$sessionCount'] },
              { $multiply: [{ $divide: ['$sessionCount', '$daysSinceFirst'] }, 365] }
            ]
          }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 20 }
    ]);
  }

  async getCustomerFrequencyAnalysis(snookerHouseId) {
    return await Session.aggregate([
      { 
        $match: { 
          snookerHouse: snookerHouseId,
          customerName: { $ne: 'Guest' }
        } 
      },
      {
        $group: {
          _id: '$customerName',
          sessionCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $eq: ['$sessionCount', 1] }, then: 'One-time' },
                { case: { $lte: ['$sessionCount', 3] }, then: 'Occasional' },
                { case: { $lte: ['$sessionCount', 10] }, then: 'Regular' }
              ],
              default: 'Frequent'
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);
  }

  async getCustomerSessionPatterns(snookerHouseId) {
    return await Session.aggregate([
      { 
        $match: { 
          snookerHouse: snookerHouseId, 
          status: 'completed'
        } 
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$startTime' },
            dayOfWeek: { $dayOfWeek: '$startTime' }
          },
          sessionCount: { $sum: 1 },
          avgRevenue: { $avg: '$totalCost' }
        }
      },
      {
        $group: {
          _id: '$_id.hour',
          totalSessions: { $sum: '$sessionCount' },
          avgRevenue: { $avg: '$avgRevenue' },
          dayBreakdown: {
            $push: {
              day: '$_id.dayOfWeek',
              sessions: '$sessionCount'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  }
}

// 🔧 KEY FIX: Export the class itself, not an instance
module.exports = BusinessAnalyticsController;