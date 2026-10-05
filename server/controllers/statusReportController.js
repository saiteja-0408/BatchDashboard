/**
 * statusReportController.js — handler for GET /api/status-report
 *
 * Query:
 *   SELECT * FROM db2prd1.T_Z_QRTZ_STATUS_REPORT
 *   WHERE date(start_time) >= current_date
 *   ORDER BY start_time DESC
 *
 * Caching strategy:
 *   The server-side cache TTL is driven by STATUS_REPORT_CACHE_TTL_MS, which is
 *   read from the STATUS_REPORT_CACHE_TTL_MS environment variable.
 *
 *   Default: the value of VITE_STATUS_REPORT_REFRESH_INTERVAL_MS (same as the
 *   frontend polling interval) — this guarantees that every browser poll after
 *   the TTL has expired triggers a fresh DB query. If neither variable is set,
 *   the fallback is 10 seconds (matching the default frontend interval).
 *
 *   Query parameters:
 *     ?fresh=true  — bypass the cache and execute a live DB query.
 *                    The fresh result replaces the cache entry.
 *                    Use this for scheduled polling so every interval tick
 *                    always hits the database.
 *     ?force=true  — alias for ?fresh=true (backward-compatible).
 *
 *   Response includes `cacheHit` boolean and `cachedAt` ISO timestamp so the
 *   frontend can display "last updated" information accurately.
 *
 *   A `cache-hit` response header mirrors cacheHit for browser DevTools.
 *
 * Error handling:
 *   - DB2 connection/config errors → 503 with structured JSON error body.
 *   - Failed queries never populate the cache, so the next poll retries DB2.
 *   - asyncWrapper in routes forwards thrown errors to the global error handler.
 */

'use strict';

const { queryDb2, getBackend } = require('../services/db2Service');
const cache                    = require('../services/cacheService');

/** Cache key — constant because the query is always identical. */
const STATUS_REPORT_CACHE_KEY = 'status_report_today';

/**
 * TTL for the server-side cache in milliseconds.
 *
 * Resolution order:
 *   1. STATUS_REPORT_CACHE_TTL_MS env var  — explicit server-side TTL override
 *   2. VITE_STATUS_REPORT_REFRESH_INTERVAL_MS env var — align with frontend poll
 *   3. 10 000 ms (10 s) — safe default matching the default frontend interval
 *
 * Setting this equal to (or slightly less than) VITE_STATUS_REPORT_REFRESH_INTERVAL_MS
 * ensures the cache has expired by the time the next browser poll arrives, so
 * every poll executes a fresh DB query rather than returning stale cached data.
 */
function resolveStatusReportTtl() {
  const raw =
    process.env.STATUS_REPORT_CACHE_TTL_MS ||
    process.env.VITE_STATUS_REPORT_REFRESH_INTERVAL_MS ||
    null;

  if (raw !== null) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 10_000; // 10 s default
}

/**
 * Server-side cache TTL in milliseconds.
 * Evaluated once at module load so it reflects the env at startup.
 */
const STATUS_REPORT_TTL_MS = resolveStatusReportTtl();

/**
 * Builds the status-report SQL for the active backend.
 * DB2 uses the DB2_SCHEMA env var (default: db2prd1); PG uses PG_SCHEMA (default: public).
 * The schema is validated to contain only word characters to prevent injection.
 * @returns {string}
 */
function buildStatusReportSql() {
  const backend = getBackend();
  let schema;
  if (backend === 'pg') {
    schema = process.env.PG_SCHEMA || 'public';
  } else {
    schema = process.env.DB2_SCHEMA || 'db2prd1';
  }
  // SEC-08: allow only word characters (letters, digits, underscore) in schema name
  if (!/^\w+$/.test(schema)) {
    throw new Error(`Invalid schema name "${schema}" — must contain only word characters.`);
  }
  return `SELECT * FROM ${schema}.T_Z_QRTZ_STATUS_REPORT WHERE date(start_time) >= current_date ORDER BY start_time DESC`;
}

/**
 * GET /api/status-report[?fresh=true][?force=true]
 *
 * Returns today's status report rows from DB2, cached for STATUS_REPORT_TTL_MS.
 *
 * ?fresh=true (or legacy ?force=true) — bypass the cache and execute a live
 * DB query. The result replaces the cache entry so the next plain request is
 * still served from cache until the TTL expires again.
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
/** Tracks an in-flight DB query promise so concurrent cache-miss requests are coalesced (PERF-02). */
let _inFlightQuery = null;

async function getStatusReport(req, res) {
  // ?fresh=true is the canonical poll bypass; ?force=true is the legacy alias
  const bypassCache = req.query.fresh === 'true' || req.query.force === 'true';

  // ── Cache lookup (skip when bypass requested) ─────────────────────────────
  if (!bypassCache) {
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

  // ── Cache miss or bypass — execute live DB query (coalesced) ─────────────
  // PERF-02: if another request is already querying the DB, wait for that
  // promise rather than firing a second identical query.
  if (!bypassCache && _inFlightQuery) {
    const rows = await _inFlightQuery;
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

  const sql = buildStatusReportSql();

  if (!bypassCache) {
    _inFlightQuery = queryDb2(sql).finally(() => { _inFlightQuery = null; });
  }
  const rawRows = await (bypassCache ? queryDb2(sql) : _inFlightQuery);

  // DB2 returns column names in UPPERCASE — normalise to lowercase so the
  // frontend column definitions (job_name, start_time, …) match correctly.
  const rows = rawRows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.toLowerCase(), v])
    )
  );

  // Persist to cache — replaces any previous entry (including after a bypass)
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

module.exports = {
  getStatusReport,
  STATUS_REPORT_CACHE_KEY,
  STATUS_REPORT_TTL_MS,
  resolveStatusReportTtl,
};
