/**
 * pg.config.js — PostgreSQL connection pool configuration.
 *
 * All values are sourced from environment variables so credentials are never
 * hardcoded. Update the env vars (or .env file) to change the target database
 * without touching this file.
 *
 * Environment variables:
 *   PG_HOST      — PostgreSQL server hostname or IP  (default: 127.0.0.1)
 *   PG_PORT      — PostgreSQL server port            (default: 5432)
 *   PG_DATABASE  — Database name
 *   PG_USER      — PostgreSQL username
 *   PG_PASSWORD  — PostgreSQL password
 *   PG_SCHEMA    — Default search_path schema        (default: public)
 *
 * The pool is created lazily (first call to getPool()) so the server starts
 * cleanly even when pg credentials are absent (mock mode).
 */

'use strict';

let _pool = null;

/**
 * Returns the required PG env vars that are missing.
 * @returns {string[]}
 */
function getMissingPgVars() {
  return ['PG_HOST', 'PG_DATABASE', 'PG_USER', 'PG_PASSWORD'].filter(
    (k) => !process.env[k]
  );
}

/**
 * Returns (and lazily creates) the shared pg.Pool instance.
 * Throws a descriptive 503 error if any required variable is missing.
 *
 * @returns {import('pg').Pool}
 */
function getPool() {
  if (_pool) return _pool;

  const missing = getMissingPgVars();
  if (missing.length > 0) {
    const err = new Error(
      `PostgreSQL configuration is incomplete. Missing environment variables: ${missing.join(', ')}. ` +
      'Set these in your .env file before using the Status Report feature with PostgreSQL.'
    );
    err.status = 503;
    throw err;
  }

  const { Pool } = require('pg'); // eslint-disable-line

  _pool = new Pool({
    host:     process.env.PG_HOST     || '127.0.0.1',
    port:     parseInt(process.env.PG_PORT || '5432', 10),
    database: process.env.PG_DATABASE,
    user:     process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    // Set search_path so unqualified table names resolve to the right schema
    options:  `--search_path=${process.env.PG_SCHEMA || 'public'}`,
    // Pool sizing — conservative defaults suitable for a dashboard workload
    max:                10,
    idleTimeoutMillis:  30_000,
    connectionTimeoutMillis: 5_000,
  });

  // Log pool-level errors so they appear in the server log rather than crashing
  _pool.on('error', (err) => {
    console.error('[pgService] Idle client error:', err.message);
  });

  return _pool;
}

/**
 * Closes the pool on process shutdown so connections are released cleanly.
 * Called from app.js on SIGTERM / SIGINT.
 */
async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

module.exports = { getPool, closePool, getMissingPgVars };
