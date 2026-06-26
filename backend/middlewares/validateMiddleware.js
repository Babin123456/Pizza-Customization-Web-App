import AppError from '../utils/appError.js';

export const validateBody = (schema) => {
  return (req, res, next) => {
    const errors = [];
    const body = req.body || {};

    Object.keys(schema).forEach((key) => {
      const rules = schema[key];
      const val = body[key];

      // Required check
      if (rules.required && (val === undefined || val === null || String(val).trim() === '')) {
        errors.push(`Field '${key}' is required.`);
        return;
      }

      if (val !== undefined && val !== null) {
        // Type check
        if (rules.type === 'string' && typeof val !== 'string') {
          errors.push(`Field '${key}' must be a string.`);
        }
        if (rules.type === 'number' && typeof val !== 'number') {
          errors.push(`Field '${key}' must be a number.`);
        }
        if (rules.type === 'array' && !Array.isArray(val)) {
          errors.push(`Field '${key}' must be an array.`);
        }

        // Min length check
        if (rules.minLength && typeof val === 'string' && val.length < rules.minLength) {
          errors.push(`Field '${key}' must be at least ${rules.minLength} characters long.`);
        }

        // Regex pattern check
        if (rules.pattern && typeof val === 'string' && !rules.pattern.test(val)) {
          errors.push(rules.message || `Field '${key}' is invalid.`);
        }
      }
    });

    if (errors.length > 0) {
      return next(new AppError(errors.join(' '), 400));
    }

    next();
  };
};
