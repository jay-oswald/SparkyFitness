const { log } = require('../config/logging');

const errorHandler = (err, req, res, next) => {
  log('error', `Error caught by centralized handler: ${err.message}`, err.stack);

  // Default to 500 Internal Server Error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific error types if needed (e.g., database errors, validation errors)
  if (err.name === 'UnauthorizedError') { // Example for JWT errors
    statusCode = 401;
    message = 'Unauthorized: Invalid or missing token.';
  } else if (err.name === 'ForbiddenError') { // Example for custom forbidden errors
    statusCode = 403;
    message = 'Forbidden: You do not have permission to perform this action.';
  } else if (err.code === '23505') { // PostgreSQL unique violation error code
    statusCode = 409;
    message = 'Conflict: A resource with this unique identifier already exists.';
  } else if (err.name === 'ValidationError') { // Example for validation errors
    statusCode = 400;
    message = err.message; // Use the specific validation error message
  }

  res.status(statusCode).json({
    error: message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined, // Only send stack in development
  });
};

module.exports = errorHandler;