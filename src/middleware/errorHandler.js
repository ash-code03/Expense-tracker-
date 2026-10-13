/**
 * 404 Not Found Middleware
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
};

/**
 * Global Error Handler Middleware
 * Prevents internal stack traces and database credentials from leaking to the client
 */
const errorHandler = (err, req, res, next) => {
  // Log error internally for debugging
  console.error('[Error]', {
    message: err.message,
    method: req.method,
    url: req.originalUrl,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  // Friendly message for database or general internal errors
  let clientMessage = err.message || 'An unexpected internal server error occurred.';
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    clientMessage = 'An internal server error occurred. Please try again later.';
  }

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
