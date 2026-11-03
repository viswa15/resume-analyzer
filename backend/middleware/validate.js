// backend/middleware/validate.js
const ApiError = require('../utils/ApiError');

// Returns Express middleware that validates req.body against a Zod schema,
// replacing req.body with the parsed (and coerced) data on success.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ApiError(400, 'Validation failed.', result.error.flatten()));
  }
  req.body = result.data;
  next();
};

module.exports = validate;
