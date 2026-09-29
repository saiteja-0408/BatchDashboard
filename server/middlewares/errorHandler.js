/**
 * errorHandler.js — global Express error-handling middleware
 *
 * Must be registered LAST in app.js (after all routes).
 * Catches errors thrown via next(err) or thrown inside async route handlers
 * wrapped with asyncWrapper.
 */

/**
 * Generic error response — never expose stack traces to the client in production.
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV !== 'production';

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.url} — ${err.message}`);
  if (isDev) console.error(err.stack);

  res.status(status).json({
    success: false,
    error: {
      message: err.message || 'Internal server error',
      // Only include stack in development to avoid information disclosure
      ...(isDev && { stack: err.stack }),
    },
  });
}

/**
 * Wraps an async Express route handler so unhandled promise rejections
 * are forwarded to the error-handling middleware automatically.
 * @param {Function} fn  Async route handler
 * @returns {Function}
 */
function asyncWrapper(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncWrapper };
