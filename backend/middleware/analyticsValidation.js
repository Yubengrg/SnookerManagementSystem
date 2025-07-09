const Joi = require('joi');

// ===========================================
// ANALYTICS VALIDATION SCHEMAS
// ===========================================

// Financial report query validation
const financialReportQuerySchema = Joi.object({
  period: Joi.string()
    .valid('today', 'week', 'month', 'year', 'custom')
    .optional()
    .default('month')
    .messages({
      'any.only': 'Period must be one of: today, week, month, year, custom'
    }),
  
  startDate: Joi.when('period', {
    is: 'custom',
    then: Joi.date()
      .iso()
      .required()
      .messages({
        'date.base': 'Start date must be a valid date',
        'any.required': 'Start date is required for custom period'
      }),
    otherwise: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.base': 'Start date must be a valid date'
      })
  }),
  
  endDate: Joi.when('period', {
    is: 'custom',
    then: Joi.date()
      .iso()
      .min(Joi.ref('startDate'))
      .required()
      .messages({
        'date.base': 'End date must be a valid date',
        'date.min': 'End date must be after start date',
        'any.required': 'End date is required for custom period'
      }),
    otherwise: Joi.date()
      .iso()
      .min(Joi.ref('startDate'))
      .optional()
      .messages({
        'date.base': 'End date must be a valid date',
        'date.min': 'End date must be after start date'
      })
  }),
  
  format: Joi.string()
    .valid('json', 'csv', 'pdf')
    .optional()
    .default('json')
    .messages({
      'any.only': 'Format must be json, csv, or pdf'
    }),
  
  includeDetails: Joi.boolean()
    .optional()
    .default(true)
    .messages({
      'boolean.base': 'Include details must be true or false'
    })
});

// Customer analytics query validation
const customerAnalyticsQuerySchema = Joi.object({
  segment: Joi.string()
    .valid('all', 'vip', 'premium', 'regular', 'frequent', 'new')
    .optional()
    .default('all')
    .messages({
      'any.only': 'Segment must be one of: all, vip, premium, regular, frequent, new'
    }),
  
  timeframe: Joi.string()
    .valid('week', 'month', 'quarter', 'year', 'all')
    .optional()
    .default('month')
    .messages({
      'any.only': 'Timeframe must be one of: week, month, quarter, year, all'
    }),
  
  minSessions: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.min': 'Minimum sessions must be at least 1',
      'number.integer': 'Minimum sessions must be a whole number'
    }),
  
  minSpent: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Minimum spent cannot be negative'
    })
});

// Dashboard query validation
const dashboardQuerySchema = Joi.object({
  refresh: Joi.boolean()
    .optional()
    .default(false)
    .messages({
      'boolean.base': 'Refresh must be true or false'
    }),
  
  includeComparisons: Joi.boolean()
    .optional()
    .default(true)
    .messages({
      'boolean.base': 'Include comparisons must be true or false'
    }),
  
  trendDays: Joi.number()
    .integer()
    .min(7)
    .max(365)
    .optional()
    .default(30)
    .messages({
      'number.min': 'Trend days must be at least 7',
      'number.max': 'Trend days cannot exceed 365',
      'number.integer': 'Trend days must be a whole number'
    })
});

// ===========================================
// VALIDATION MIDDLEWARE FUNCTION
// ===========================================

// Middleware function to validate query parameters
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false, // Return all validation errors
      allowUnknown: false, // Don't allow unknown fields
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Query validation error',
        errors
      });
    }

    // Replace req.query with validated and sanitized data
    req.query = value;
    next();
  };
};

// ===========================================
// EXPORTED VALIDATION MIDDLEWARES
// ===========================================

module.exports = {
  // Analytics validations
  validateFinancialReportQuery: validateQuery(financialReportQuerySchema),
  validateCustomerAnalyticsQuery: validateQuery(customerAnalyticsQuerySchema),
  validateDashboardQuery: validateQuery(dashboardQuerySchema),
  
  // Export schemas for testing
  schemas: {
    financialReportQuerySchema,
    customerAnalyticsQuerySchema,
    dashboardQuerySchema
  }
};