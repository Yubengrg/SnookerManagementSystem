const Joi = require('joi');

// ===========================================
// PRODUCT VALIDATION SCHEMAS
// ===========================================

// Create product validation schema
const createProductSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Product name must be at least 2 characters long',
      'string.max': 'Product name cannot exceed 100 characters',
      'string.empty': 'Product name is required'
    }),
  
  barcode: Joi.string()
    .trim()
    .max(50)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Barcode cannot exceed 50 characters'
    }),
  
  category: Joi.string()
    .valid('snacks', 'drinks', 'cigarettes', 'accessories', 'other')
    .required()
    .messages({
      'any.only': 'Category must be one of: snacks, drinks, cigarettes, accessories, other',
      'any.required': 'Category is required'
    }),
  
  costPrice: Joi.number()
    .min(0)
    .required()
    .messages({
      'number.min': 'Cost price cannot be negative',
      'any.required': 'Cost price is required'
    }),
  
  sellingPrice: Joi.number()
    .min(0)
    .required()
    .messages({
      'number.min': 'Selling price cannot be negative',
      'any.required': 'Selling price is required'
    }),
  
  currentStock: Joi.number()
    .integer()
    .min(0)
    .optional()
    .default(0)
    .messages({
      'number.min': 'Current stock cannot be negative',
      'number.integer': 'Current stock must be a whole number'
    }),
  
  minStockLevel: Joi.number()
    .integer()
    .min(0)
    .optional()
    .default(5)
    .messages({
      'number.min': 'Minimum stock level cannot be negative',
      'number.integer': 'Minimum stock level must be a whole number'
    }),
  
  unit: Joi.string()
    .valid('piece', 'packet', 'bottle', 'can', 'box', 'kg', 'litre')
    .optional()
    .default('piece')
    .messages({
      'any.only': 'Unit must be one of: piece, packet, bottle, can, box, kg, litre'
    }),
  
  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  
  productImage: Joi.string()
    .uri()
    .pattern(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i)
    .optional()
    .allow('')
    .messages({
      'string.uri': 'Please provide a valid image URL',
      'string.pattern.base': 'Product image must be a valid image URL (jpg, jpeg, png, gif, webp)'
    })
});

// Update product validation schema
const updateProductSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Product name must be at least 2 characters long',
      'string.max': 'Product name cannot exceed 100 characters'
    }),
  
  barcode: Joi.string()
    .trim()
    .max(50)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Barcode cannot exceed 50 characters'
    }),
  
  category: Joi.string()
    .valid('snacks', 'drinks', 'cigarettes', 'accessories', 'other')
    .optional()
    .messages({
      'any.only': 'Category must be one of: snacks, drinks, cigarettes, accessories, other'
    }),
  
  costPrice: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Cost price cannot be negative'
    }),
  
  sellingPrice: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Selling price cannot be negative'
    }),
  
  currentStock: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Current stock cannot be negative',
      'number.integer': 'Current stock must be a whole number'
    }),
  
  minStockLevel: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Minimum stock level cannot be negative',
      'number.integer': 'Minimum stock level must be a whole number'
    }),
  
  unit: Joi.string()
    .valid('piece', 'packet', 'bottle', 'can', 'box', 'kg', 'litre')
    .optional()
    .messages({
      'any.only': 'Unit must be one of: piece, packet, bottle, can, box, kg, litre'
    }),
  
  status: Joi.string()
    .valid('active', 'inactive', 'discontinued')
    .optional()
    .messages({
      'any.only': 'Status must be active, inactive, or discontinued'
    }),
  
  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  
  productImage: Joi.string()
    .uri()
    .pattern(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i)
    .optional()
    .allow('')
    .messages({
      'string.uri': 'Please provide a valid image URL',
      'string.pattern.base': 'Product image must be a valid image URL (jpg, jpeg, png, gif, webp)'
    })
});

// Update stock validation schema
const updateStockSchema = Joi.object({
  quantity: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      'number.min': 'Quantity must be at least 1',
      'number.integer': 'Quantity must be a whole number',
      'any.required': 'Quantity is required'
    }),
  
  operation: Joi.string()
    .valid('add', 'subtract', 'set')
    .optional()
    .default('add')
    .messages({
      'any.only': 'Operation must be add, subtract, or set'
    }),
  
  notes: Joi.string()
    .trim()
    .max(200)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Notes cannot exceed 200 characters'
    })
});

// ===========================================
// SALE VALIDATION SCHEMAS
// ===========================================

// Sale item schema
const saleItemSchema = Joi.object({
  productId: Joi.string()
    .required()
    .messages({
      'any.required': 'Product ID is required'
    }),
  
  quantity: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      'number.min': 'Quantity must be at least 1',
      'number.integer': 'Quantity must be a whole number',
      'any.required': 'Quantity is required'
    })
});

// Record sale validation schema
const recordSaleSchema = Joi.object({
  items: Joi.array()
    .items(saleItemSchema)
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one item is required',
      'any.required': 'Items are required'
    }),
  
  paymentMethod: Joi.string()
    .valid('cash', 'card', 'mobile', 'credit')
    .optional()
    .default('cash')
    .messages({
      'any.only': 'Payment method must be cash, card, mobile, or credit'
    }),
  
  customerName: Joi.string()
    .trim()
    .max(100)
    .optional()
    .allow('')
    .messages({
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
    }),
  
  sessionId: Joi.string()
    .optional()
    .allow('')
    .messages({
      'string.base': 'Session ID must be a string'
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
  // Product validations
  validateCreateProduct: validate(createProductSchema),
  validateUpdateProduct: validate(updateProductSchema),
  validateUpdateStock: validate(updateStockSchema),
  
  // Sale validations
  validateRecordSale: validate(recordSaleSchema),
  
  // Export schemas for testing
  schemas: {
    createProductSchema,
    updateProductSchema,
    updateStockSchema,
    recordSaleSchema
  }
};