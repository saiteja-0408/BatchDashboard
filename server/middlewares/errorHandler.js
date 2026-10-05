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
  const isDev  = process.env.NODE_ENV !== 'production';

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.url} — ${err.message}`);
  if (isDev) console.error(err.stack);

  // ERR-03: normalise Multer errors to proper 4xx HTTP status codes
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: { message: 'File too large — maximum upload size is 10 MB.' } });
  }
  if (err.code && err.code.startsWith('LIMIT_')) {
    return res.status(400).json({ success: false, error: { message: `Multer upload error: ${err.message}` } });
  }

  // SEC-06: only expose internal error messages for client errors (4xx) or
  // when err.expose is explicitly set; 5xx in production gets a generic message.
  const exposeMessage = status < 500 || err.expose || isDev;

  res.status(status).json({
    success: false,
    error: {
      message: exposeMessage ? (err.message || 'Internal server error') : 'Internal server error',
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
