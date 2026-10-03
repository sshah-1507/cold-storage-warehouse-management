/**
 * Centralized error handler
 * Ensures standard contract format:
 * { "error": { "code": "...", "message": "..." } }
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error('[Error Handler]:', err);

  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const errorMessage = err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: errorMessage,
    },
  });
}

/**
 * 404 Route Not Found handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
