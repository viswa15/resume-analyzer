// backend/middleware/errorHandler.js
const logger = require('../utils/logger');

// Centralized error handler. Any error passed to next(err) anywhere in the
// app (including from asyncHandler-wrapped controllers) ends up here.
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    // Full detail (name/status/stack) goes to the log so the real cause of a
    // 500 is always recoverable from backend/logs/error.log, even though the
    // client only ever sees the generic message below.
    logger.error(err.message, {
      stack: err.stack,
      name: err.name,
      status: err.status,
      method: req.method,
      path: req.originalUrl,
    });
  } else {
    logger.warn(err.message, { method: req.method, path: req.originalUrl });
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Something went wrong!' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
};

module.exports = errorHandler;
