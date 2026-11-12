/**
 * pg.config.js — PostgreSQL connection pool configuration.
 *
 * Accepts either a full connection URL or individual credential vars.
 * URL takes priority when both are present.
 *
 * Option A — Connection URL (recommended when you have a pg URL):
 *   PG_CONNECTION_URL=postgresql://user:password@host:5432/dbname
 *
 * Option B — Individual variables:
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
 * Returns true when a usable PG configuration is present.
 * Either PG_CONNECTION_URL alone, or all four individual vars.
 * @returns {string[]} list of missing vars (empty = config is complete)
 */
function getMissingPgVars() {
  // If a full URL is provided, nothing else is needed
  if (process.env.PG_CONNECTION_URL) return [];

  // Otherwise all four individual vars are required
  return ['PG_HOST', 'PG_DATABASE', 'PG_USER', 'PG_PASSWORD'].filter(
    (k) => !process.env[k]
  );
}

/**
 * Returns (and lazily creates) the shared pg.Pool instance.
 * Throws a descriptive 503 error if configuration is incomplete.
 *
 * @returns {import('pg').Pool}
 */
function getPool() {
  if (_pool) return _pool;

  const missing = getMissingPgVars();
  if (missing.length > 0) {
    const err = new Error(
      'PostgreSQL configuration is incomplete. ' +
      'Provide either PG_CONNECTION_URL or all of: ' +
      `${missing.join(', ')} in your .env file.`
    );
    err.status = 503;
    throw err;
  }

  const { Pool } = require('pg'); // eslint-disable-line

  const poolConfig = process.env.PG_CONNECTION_URL
    // ── URL mode ─────────────────────────────────────────────────────────────
    ? {
        connectionString: process.env.PG_CONNECTION_URL,
        // Set search_path when schema override is specified
        ...(process.env.PG_SCHEMA && {
          options: `--search_path=${process.env.PG_SCHEMA}`,
        }),
      }
    // ── Individual vars mode ─────────────────────────────────────────────────
    : {
        host:     process.env.PG_HOST     || '127.0.0.1',
        port:     parseInt(process.env.PG_PORT || '5432', 10),
        database: process.env.PG_DATABASE,
        user:     process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        options:  `--search_path=${process.env.PG_SCHEMA || 'public'}`,
      };

  _pool = new Pool({
    ...poolConfig,
    // Pool sizing — conservative defaults suitable for a dashboard workload
    max:                     10,
    idleTimeoutMillis:       30_000,
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
 */
async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

module.exports = { getPool, closePool, getMissingPgVars };
