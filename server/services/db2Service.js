/**
 * db2Service.js — DB2 query execution wrapper.
 *
 * Provides a single `queryDb2(sql, params)` function used by all controllers.
 *
 * MOCK MODE:
 *   Activated when either of these conditions is true:
 *     1. USE_MOCK_DATA=true is set in .env
 *     2. Any required DB2 env var (DB2_HOST, DB2_DATABASE, DB2_USER, DB2_PASSWORD)
 *        is missing — so the server works out-of-the-box locally without credentials.
 *
 *   In mock mode, queryDb2() ignores the SQL and returns the exported
 *   MOCK_STATUS_REPORT_ROWS from mockData.js.
 *
 * PRODUCTION MODE:
 *   When USE_MOCK_DATA is absent/false AND all DB2 env vars are set, the real
 *   ibm_db driver is used. No code changes are needed — only .env changes.
 *
 * ibm_db must be installed for production: `npm install ibm_db`
 */

'use strict';

const { getDb2ConnectionString } = require('../config/db2.config');
const { MOCK_STATUS_REPORT_ROWS } = require('./mockData');

/**
 * Returns true when mock mode is active.
 * Mock mode is on if USE_MOCK_DATA=true OR any required DB2 credential is absent.
 *
 * @returns {boolean}
 */
function isMockMode() {
  if (process.env.USE_MOCK_DATA === 'true') return true;

  const required = ['DB2_HOST', 'DB2_DATABASE', 'DB2_USER', 'DB2_PASSWORD'];
  return required.some((k) => !process.env[k]);
}

/**
 * Executes a parameterised DB2 query and returns the result rows as plain objects.
 *
 * In mock mode: ignores `sql`/`params` and returns MOCK_STATUS_REPORT_ROWS.
 * In production mode: opens a real ibm_db connection, runs the query, closes it.
 *
 * @param {string}  sql          — Parameterised SQL (? placeholders)
 * @param {Array}   [params=[]]  — Bound parameter values
 * @returns {Promise<Object[]>}  Array of row objects
 * @throws {Error}               When not in mock mode and the connection/query fails
 */
async function queryDb2(sql, params = []) {
  // ── Mock mode: return static data, no DB2 connection needed ─────────────────
  if (isMockMode()) {
    return MOCK_STATUS_REPORT_ROWS;
  }

  // ── Production mode: use real ibm_db ────────────────────────────────────────
  let ibm_db;
  try {
    // Require lazily so the server starts cleanly when ibm_db is not installed.
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

module.exports = { queryDb2, isMockMode };
