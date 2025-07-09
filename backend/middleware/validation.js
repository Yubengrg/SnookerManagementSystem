const Joi = require('joi');

// ===========================================
// AUTH VALIDATION SCHEMAS
// ===========================================

// Signup validation schema
const signupSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .required()
    .messages({
      'string.pattern.base': 'First name should only contain letters and spaces',
      'string.min': 'First name must be at least 2 characters long',
      'string.max': 'First name cannot exceed 50 characters'
    }),
  
  lastName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Last name should only contain letters and spaces',
      'string.min': 'Last name must be at least 2 characters long',
      'string.max': 'Last name cannot exceed 50 characters'
    }),
  
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please enter a valid email address'
    }),
  
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.max': 'Password cannot exceed 128 characters'
    }),
  
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Passwords do not match'
    })
});

// Login validation schema
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please enter a valid email address'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required'
    }),
  
  rememberMe: Joi.boolean().optional()
});

// OTP validation schema
const otpSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please enter a valid email address'
    }),
  
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'OTP must be exactly 6 digits'
    }),
  
  purpose: Joi.string()
    .valid('signup', 'login', 'password_reset', 'email_verification')
    .required(),
  
  rememberMe: Joi.boolean().optional()
});

// Email only validation schema
const emailSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please enter a valid email address'
    }),
  
  purpose: Joi.string()
    .valid('signup', 'login', 'password_reset', 'email_verification')
    .optional()
});

// Profile update validation schema
const profileUpdateSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'First name should only contain letters and spaces',
      'string.min': 'First name must be at least 2 characters long',
      'string.max': 'First name cannot exceed 50 characters'
    }),
  
  lastName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Last name should only contain letters and spaces',
      'string.min': 'Last name must be at least 2 characters long',
      'string.max': 'Last name cannot exceed 50 characters'
    }),
  
  profilePicture: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.uri': 'Profile picture must be a valid URL'
    })
});

// Change password validation schema
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'string.empty': 'Current password is required'
    }),
  
  newPassword: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'New password must be at least 6 characters long',
      'string.max': 'New password cannot exceed 128 characters'
    }),
  
  confirmNewPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'New passwords do not match'
    })
});

// ===========================================
// SNOOKER HOUSE VALIDATION SCHEMAS
// ===========================================

// Snooker house creation validation schema
const createSnookerHouseSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.min': 'Snooker house name must be at least 3 characters long',
      'string.max': 'Snooker house name cannot exceed 100 characters',
      'string.empty': 'Snooker house name is required'
    }),
  
  profilePicture: Joi.string()
    .uri()
    .pattern(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i)
    .optional()
    .allow('')
    .messages({
      'string.uri': 'Please provide a valid image URL',
      'string.pattern.base': 'Profile picture must be a valid image URL (jpg, jpeg, png, gif, webp)'
    }),
  
  address: Joi.string()
    .trim()
    .min(10)
    .max(200)
    .required()
    .messages({
      'string.min': 'Address must be at least 10 characters long',
      'string.max': 'Address cannot exceed 200 characters',
      'string.empty': 'Address is required'
    })
});

// Update snooker house validation schema (all fields optional)
const updateSnookerHouseSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Snooker house name must be at least 3 characters long',
      'string.max': 'Snooker house name cannot exceed 100 characters'
    }),
  
  profilePicture: Joi.string()
    .uri()
    .pattern(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i)
    .optional()
    .allow('')
    .messages({
      'string.uri': 'Please provide a valid image URL',
      'string.pattern.base': 'Profile picture must be a valid image URL (jpg, jpeg, png, gif, webp)'
    }),
  
  address: Joi.string()
    .trim()
    .min(10)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Address must be at least 10 characters long',
      'string.max': 'Address cannot exceed 200 characters'
    })
});

// ===========================================
// TABLE VALIDATION SCHEMAS
// ===========================================

// Create table validation schema
const createTableSchema = Joi.object({
  tableNumber: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'number.min': 'Table number must be at least 1',
      'number.max': 'Table number cannot exceed 100',
      'number.integer': 'Table number must be a whole number'
    }),
  
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Table name must be at least 2 characters long',
      'string.max': 'Table name cannot exceed 50 characters',
      'string.empty': 'Table name is required'
    }),
  
  pricingMethod: Joi.string()
    .valid('per_minute', 'frame_kitti')
    .required()
    .messages({
      'any.only': 'Pricing method must be either per_minute or frame_kitti',
      'any.required': 'Pricing method is required'
    }),
  
  // Conditional validation for per_minute pricing
  hourlyRate: Joi.when('pricingMethod', {
    is: 'per_minute',
    then: Joi.number()
      .min(0)
      .max(10000)
      .required()
      .messages({
        'number.min': 'Hourly rate cannot be negative',
        'number.max': 'Hourly rate cannot exceed 10,000',
        'any.required': 'Hourly rate is required for per-minute pricing'
      }),
    otherwise: Joi.forbidden()
  }),
  
  // Conditional validation for frame_kitti pricing
  frameRate: Joi.when('pricingMethod', {
    is: 'frame_kitti',
    then: Joi.number()
      .min(0)
      .max(10000)
      .required()
      .messages({
        'number.min': 'Frame rate cannot be negative',
        'number.max': 'Frame rate cannot exceed 10,000',
        'any.required': 'Frame rate is required for frame & kitti pricing'
      }),
    otherwise: Joi.forbidden()
  }),
  
  kittiRate: Joi.when('pricingMethod', {
    is: 'frame_kitti',
    then: Joi.number()
      .min(0)
      .max(10000)
      .required()
      .messages({
        'number.min': 'Kitti rate cannot be negative',
        'number.max': 'Kitti rate cannot exceed 10,000',
        'any.required': 'Kitti rate is required for frame & kitti pricing'
      }),
    otherwise: Joi.forbidden()
  }),
  
  description: Joi.string()
    .trim()
    .max(200)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 200 characters'
    })
});

// Update table validation schema
const updateTableSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': 'Table name must be at least 2 characters long',
      'string.max': 'Table name cannot exceed 50 characters'
    }),
  
  pricingMethod: Joi.string()
    .valid('per_minute', 'frame_kitti')
    .optional()
    .messages({
      'any.only': 'Pricing method must be either per_minute or frame_kitti'
    }),
  
  // Conditional validation for per_minute pricing
  hourlyRate: Joi.when('pricingMethod', {
    is: 'per_minute',
    then: Joi.number()
      .min(0)
      .max(10000)
      .required()
      .messages({
        'number.min': 'Hourly rate cannot be negative',
        'number.max': 'Hourly rate cannot exceed 10,000',
        'any.required': 'Hourly rate is required for per-minute pricing'
      }),
    otherwise: Joi.number()
      .min(0)
      .max(10000)
      .optional()
      .messages({
        'number.min': 'Hourly rate cannot be negative',
        'number.max': 'Hourly rate cannot exceed 10,000'
      })
  }),
  
  // Conditional validation for frame_kitti pricing
  frameRate: Joi.when('pricingMethod', {
    is: 'frame_kitti',
    then: Joi.number()
      .min(0)
      .max(10000)
      .required()
      .messages({
        'number.min': 'Frame rate cannot be negative',
        'number.max': 'Frame rate cannot exceed 10,000',
        'any.required': 'Frame rate is required for frame & kitti pricing'
      }),
    otherwise: Joi.number()
      .min(0)
      .max(10000)
      .optional()
      .messages({
        'number.min': 'Frame rate cannot be negative',
        'number.max': 'Frame rate cannot exceed 10,000'
      })
  }),
  
  kittiRate: Joi.when('pricingMethod', {
    is: 'frame_kitti',
    then: Joi.number()
      .min(0)
      .max(10000)
      .required()
      .messages({
        'number.min': 'Kitti rate cannot be negative',
        'number.max': 'Kitti rate cannot exceed 10,000',
        'any.required': 'Kitti rate is required for frame & kitti pricing'
      }),
    otherwise: Joi.number()
      .min(0)
      .max(10000)
      .optional()
      .messages({
        'number.min': 'Kitti rate cannot be negative',
        'number.max': 'Kitti rate cannot exceed 10,000'
      })
  }),
  
  status: Joi.string()
    .valid('active', 'maintenance', 'inactive')
    .optional()
    .messages({
      'any.only': 'Status must be active, maintenance, or inactive'
    }),
  
  description: Joi.string()
    .trim()
    .max(200)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 200 characters'
    })
});

// ===========================================
// SESSION VALIDATION SCHEMAS
// ===========================================

// Start session validation schema with OPTIONAL customer name
const startSessionSchema = Joi.object({
  tableId: Joi.string()
    .required()
    .messages({
      'any.required': 'Table ID is required'
    }),
  
  // Customer name completely optional with default
  customerName: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .allow('')
    .default('Guest')
    .messages({
      'string.min': 'Customer name must be at least 1 character long',
      'string.max': 'Customer name cannot exceed 100 characters'
    }),
  
  customerPhone: Joi.string()
    .trim()
    .max(20)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Phone number cannot exceed 20 characters'
    }),
  
  notes: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Notes cannot exceed 500 characters'
    })
});

// Update session validation schema
const updateSessionSchema = Joi.object({
  frames: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Frames cannot be negative',
      'number.integer': 'Frames must be a whole number'
    }),
  
  kittis: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Kittis cannot be negative',
      'number.integer': 'Kittis must be a whole number'
    }),
  
  notes: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Notes cannot exceed 500 characters'
    }),
  
  action: Joi.string()
    .valid('pause', 'resume', 'update_frames_kittis', 'add_notes')
    .optional()
    .messages({
      'any.only': 'Action must be pause, resume, update_frames_kittis, or add_notes'
    })
});

// 🆕 NEW: Payment confirmation validation schema
const confirmPaymentSchema = Joi.object({
  paymentStatus: Joi.string()
    .valid('paid', 'credit')
    .required()
    .messages({
      'any.only': 'Payment status must be either "paid" or "credit"',
      'any.required': 'Payment status is required'
    }),
  
  paymentMethod: Joi.when('paymentStatus', {
    is: 'paid',
    then: Joi.string()
      .valid('esewa', 'online_banking', 'cash')
      .required()
      .messages({
        'any.only': 'Payment method must be "esewa", "online_banking", or "cash"',
        'any.required': 'Payment method is required when payment status is "paid"'
      }),
    otherwise: Joi.forbidden()
  }),
  
  transactionId: Joi.string()
    .trim()
    .max(100)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Transaction ID cannot exceed 100 characters'
    }),
  
  paymentNotes: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Payment notes cannot exceed 500 characters'
    })
});

// End session validation schema
const endSessionSchema = Joi.object({
  notes: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Notes cannot exceed 500 characters'
    })
});

// Add item to session validation schema
const addItemToSessionSchema = Joi.object({
  productId: Joi.string()
    .required()
    .messages({
      'any.required': 'Product ID is required'
    }),
  
  quantity: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .required()
    .messages({
      'number.min': 'Quantity must be at least 1',
      'number.max': 'Quantity cannot exceed 100',
      'number.integer': 'Quantity must be a whole number',
      'any.required': 'Quantity is required'
    })
});

// ===========================================
// VALIDATION MIDDLEWARE FUNCTION
// ===========================================

// Middleware function to validate request body
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
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
        message: 'Validation error',
        errors
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

// ===========================================
// EXPORTED VALIDATION MIDDLEWARES
// ===========================================

module.exports = {
  // Auth validations
  validateSignup: validate(signupSchema),
  validateLogin: validate(loginSchema),
  validateOTP: validate(otpSchema),
  validateEmail: validate(emailSchema),
  validateProfileUpdate: validate(profileUpdateSchema),
  validateChangePassword: validate(changePasswordSchema),
  
  // Snooker house validations
  validateCreateSnookerHouse: validate(createSnookerHouseSchema),
  validateUpdateSnookerHouse: validate(updateSnookerHouseSchema),
  
  // Table validations
  validateCreateTable: validate(createTableSchema),
  validateUpdateTable: validate(updateTableSchema),
  
  // Session validations
  validateStartSession: validate(startSessionSchema),
  validateUpdateSession: validate(updateSessionSchema),
  validateEndSession: validate(endSessionSchema),
  
  // Session item validations
  validateAddItemToSession: validate(addItemToSessionSchema),
  
  // 🆕 NEW: Payment validation
  validateConfirmPayment: validate(confirmPaymentSchema),
  
  // Export schemas for testing
  schemas: {
    signupSchema,
    loginSchema,
    otpSchema,
    emailSchema,
    profileUpdateSchema,
    changePasswordSchema,
    createSnookerHouseSchema,
    updateSnookerHouseSchema,
    createTableSchema,
    updateTableSchema,
    startSessionSchema,
    updateSessionSchema,
    endSessionSchema,
    addItemToSessionSchema,
    confirmPaymentSchema // 🆕 NEW: Payment schema
  }
};