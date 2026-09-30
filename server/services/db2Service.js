/**
 * db2Service.js — Status Report query execution wrapper.
 *
 * Supports three backends, selected via the STATUS_REPORT_DB env var:
 *
 *   STATUS_REPORT_DB=db2  (default)
 *     Uses ibm_db to query DB2. Requires DB2_HOST, DB2_DATABASE,
 *     DB2_USER, DB2_PASSWORD to be set.
 *
 *   STATUS_REPORT_DB=pg
 *     Uses the pg (node-postgres) pool to query PostgreSQL. Requires
 *     PG_HOST, PG_DATABASE, PG_USER, PG_PASSWORD to be set.
 *
 *   MOCK MODE (either backend)
 *     Activated when USE_MOCK_DATA=true OR when the required credentials
 *     for the selected backend are all missing. Returns static mock rows
 *     from mockData.js — no database connection needed.
 *
 * No code changes are needed to switch backends — only .env changes.
 */

'use strict';

const { getDb2ConnectionString }        = require('../config/db2.config');
const { getPool, getMissingPgVars }     = require('../config/pg.config');
const { MOCK_STATUS_REPORT_ROWS }       = require('./mockData');

const REQUIRED_DB2_VARS = ['DB2_HOST', 'DB2_DATABASE', 'DB2_USER', 'DB2_PASSWORD'];

// ── Backend selection ────────────────────────────────────────────────────────

/**
 * Returns the active backend: 'pg' | 'db2'.
 * Defaults to 'db2' when STATUS_REPORT_DB is absent or unrecognised.
 * @returns {'pg'|'db2'}
 */
function getBackend() {
  const val = (process.env.STATUS_REPORT_DB || 'db2').toLowerCase().trim();
  return val === 'pg' ? 'pg' : 'db2';
}

// ── Mock mode ────────────────────────────────────────────────────────────────

/**
 * Returns true when mock mode should be used.
 * Mock mode activates if:
 *   - USE_MOCK_DATA=true, OR
 *   - The required credentials for the selected backend are missing.
 *
 * @returns {boolean}
 */
function isMockMode() {
  if (process.env.USE_MOCK_DATA === 'true') return true;

  if (getBackend() === 'pg') {
    return getMissingPgVars().length > 0;
  }
  // db2 backend
  return REQUIRED_DB2_VARS.some((k) => !process.env[k]);
}

// ── Startup log ──────────────────────────────────────────────────────────────

/**
 * Logs the current backend / mock mode decision at server startup.
 * Called once from app.js so the operator can immediately see which
 * data source is active and which .env variables are missing if any.
 */
function logStartupMode() {
  const backend = getBackend();

  if (process.env.USE_MOCK_DATA === 'true') {
    console.log(
      `[db2Service] Mode: MOCK  (USE_MOCK_DATA=true — returning static data; ` +
      `backend=${backend} ignored)`
    );
    return;
  }

  if (backend === 'pg') {
    const missing = getMissingPgVars();
    if (missing.length > 0) {
      console.warn(
        `[db2Service] Mode: MOCK  (STATUS_REPORT_DB=pg but configuration is incomplete)\n` +
        '             Provide either PG_CONNECTION_URL or all of:\n' +
        '               PG_HOST, PG_DATABASE, PG_USER, PG_PASSWORD'
      );
    } else if (process.env.PG_CONNECTION_URL) {
      // Mask password in the URL for safe logging
      const maskedUrl = process.env.PG_CONNECTION_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
      console.log(`[db2Service] Mode: LIVE  (STATUS_REPORT_DB=pg — ${maskedUrl})`);
    } else {
      console.log(
        `[db2Service] Mode: LIVE  (STATUS_REPORT_DB=pg — connecting to ` +
        `${process.env.PG_HOST}:${process.env.PG_PORT || 5432}/` +
        `${process.env.PG_DATABASE})`
      );
    }
    return;
  }

  // DB2 backend
  const missing = REQUIRED_DB2_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.warn(
      `[db2Service] Mode: MOCK  (STATUS_REPORT_DB=db2 but the following required ` +
      `.env variables are missing: ${missing.join(', ')})\n` +
      '             Set all four variables to switch to live DB2 mode:\n' +
      '               DB2_HOST, DB2_DATABASE, DB2_USER, DB2_PASSWORD'
    );
  } else {
    console.log(
      `[db2Service] Mode: LIVE  (STATUS_REPORT_DB=db2 — connecting to ` +
      `${process.env.DB2_HOST}:${process.env.DB2_PORT || 50000})`
    );
  }
}

// ── Query execution ──────────────────────────────────────────────────────────

/**
 * Executes a query against the configured backend and returns rows.
 *
 * In mock mode  : ignores sql/params, returns MOCK_STATUS_REPORT_ROWS.
 * DB2 backend   : opens an ibm_db connection, runs the query, closes it.
 * PG  backend   : acquires a pg pool client, runs the query, releases it.
 *
 * @param {string}  sql          — SQL statement (? for DB2, $1/$2 for PG)
 * @param {Array}   [params=[]]  — Bound parameter values
 * @returns {Promise<Object[]>}  Array of row objects
 * @throws {Error}               On connection/query failure (non-mock mode)
 */
async function queryDb2(sql, params = []) {
  // ── Mock mode ──────────────────────────────────────────────────────────────
  if (isMockMode()) {
    return MOCK_STATUS_REPORT_ROWS;
  }

  const backend = getBackend();

  // ── PostgreSQL backend ─────────────────────────────────────────────────────
  if (backend === 'pg') {
    let pool;
    try {
      pool = getPool();
    } catch (cfgErr) {
      cfgErr.status = 503;
      throw cfgErr;
    }

    const result = await pool.query(sql, params.length ? params : undefined);
    return result.rows;
  }

  // ── DB2 backend (default) ──────────────────────────────────────────────────
  let ibm_db;
  try {
    ibm_db = require('ibm_db'); // eslint-disable-line
  } catch {
    const err = new Error(
      'ibm_db driver is not installed. Run `npm install ibm_db` in the project root.'
    );
    err.status = 503;
    throw err;
  }

  let connStr;
  try {
    connStr = getDb2ConnectionString();
  } catch (cfgErr) {
    cfgErr.status = 503;
    throw cfgErr;
  }

  const conn = await ibm_db.open(connStr);
  try {
    const rows = await conn.query(sql, params);
    return rows;
  } finally {
    await conn.close();
  }
}

module.exports = { queryDb2, isMockMode, logStartupMode, getBackend };
