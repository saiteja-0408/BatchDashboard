/**
 * statusReportController.js — handler for GET /api/status-report
 *
 * Query:
 *   SELECT * FROM db2prd1.T_Z_QRTZ_STATUS_REPORT
 *   WHERE date(start_time) >= current_date
 *   ORDER BY start_time DESC
 *
 * Caching strategy:
 *   - Results are cached in cacheService for STATUS_REPORT_TTL_MS (5 minutes).
 *   - Cache key: STATUS_REPORT_CACHE_KEY (constant, query is always the same).
 *   - ?force=true bypasses the cache and forces a fresh DB2 query, then refreshes
 *     the cache entry.
 *   - Response includes `cacheHit` boolean and `cachedAt` ISO timestamp.
 *   - A `cache-hit` response header mirrors the cacheHit boolean for dev tooling.
 *
 * Error handling:
 *   - DB2 connection/config errors → 503 with structured JSON error body.
 *   - asyncWrapper in routes forwards any thrown errors to the global error handler.
 */

'use strict';

const { queryDb2 }  = require('../services/db2Service');
const cache         = require('../services/cacheService');

/**
 * Cache key for the status report query.
 * Changing this constant invalidates all existing cache entries on server restart.
 */
const STATUS_REPORT_CACHE_KEY = 'status_report_today';

/**
 * TTL for the status report cache entry in milliseconds.
 * Change this value here to adjust caching behaviour without touching anything else.
 * Default: 5 minutes (300,000 ms).
 */
const STATUS_REPORT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * The DB2 query — sourced from a single constant so it can be changed in one place.
 */
const STATUS_REPORT_SQL = `
  SELECT *
  FROM db2prd1.T_Z_QRTZ_STATUS_REPORT
  WHERE date(start_time) >= current_date
  ORDER BY start_time DESC
`.trim();

/**
 * GET /api/status-report[?force=true]
 *
 * Returns today's status report rows from DB2, cached for STATUS_REPORT_TTL_MS.
 * Pass ?force=true to bypass the cache and force a fresh DB2 query.
 *
 * Response shape:
 *   {
 *     success:  true,
 *     count:    <number>,
 *     cacheHit: <boolean>,
 *     cachedAt: <ISO string>,
 *     data:     [{ job_name, job_group, start_time, end_time, next_fire_time,
 *                  biz_error_flag, error_flag, killed_flag,
 *                  parent_job_name, parent_job_group }]
 *   }
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function getStatusReport(req, res) {
  const forceRefresh = req.query.force === 'true';

  // ── Cache lookup (skip when force=true) ───────────────────────────────────
  if (!forceRefresh) {
    const hit = cache.get(STATUS_REPORT_CACHE_KEY);
    if (hit) {
      res.setHeader('cache-hit', 'true');
      return res.json({
        success:  true,
        count:    hit.value.length,
        cacheHit: true,
        cachedAt: hit.cachedAt.toISOString(),
        data:     hit.value,
      });
    }
  }

  // ── Cache miss (or force) — query DB2 ─────────────────────────────────────
  const rawRows = await queryDb2(STATUS_REPORT_SQL);

  // DB2 returns column names in UPPERCASE — normalise to lowercase so the
  // frontend column definitions (job_name, start_time, …) match correctly.
  const rows = rawRows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.toLowerCase(), v])
    )
  );

  // Persist to cache — always refresh on force=true too
  cache.set(STATUS_REPORT_CACHE_KEY, rows, STATUS_REPORT_TTL_MS);

  const freshEntry = cache.get(STATUS_REPORT_CACHE_KEY);

  res.setHeader('cache-hit', 'false');
  return res.json({
    success:  true,
    count:    rows.length,
    cacheHit: false,
    cachedAt: freshEntry ? freshEntry.cachedAt.toISOString() : new Date().toISOString(),
    data:     rows,
  });
}

module.exports = { getStatusReport, STATUS_REPORT_CACHE_KEY, STATUS_REPORT_TTL_MS };
