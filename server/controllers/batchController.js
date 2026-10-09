/**
 * batchController.js — request handlers for all batch-related endpoints.
 *
 * Each method is a thin orchestration layer:
 *   validate input → call service → format response
 * No business logic lives here.
 */

const excelService = require('../services/excelService');
const sshService   = require('../services/sshService');

/**
 * GET /api/batches?sheet=benefits|tax
 * Returns all batches, optionally filtered by sheetSource.
 */
async function getAllBatches(req, res) {
  const sheet = req.query.sheet || undefined;
  await excelService.syncFromDisk(sheet);
  const batches = excelService.getAll(sheet);
  res.json({ success: true, count: batches.length, data: batches });
}

/**
 * GET /api/batches/summary
 * Returns aggregated summary stats for dashboard cards.
 */
async function getSummary(req, res) {
  await excelService.syncFromDisk();
  const summary = excelService.getSummary();
  res.json({ success: true, data: summary });
}

/**
 * GET /api/batches/search?q=<query>&sheet=benefits|tax
 * Full-text search across batchName, scheduleName, and arguments.
 */
async function searchBatches(req, res) {
  const q     = (req.query.q || '').trim();
  const sheet = req.query.sheet || undefined;
  if (!q) {
    return res.json({ success: true, count: 0, data: [] });
  }
  await excelService.syncFromDisk(sheet);
  const results = excelService.search(q, sheet);
  res.json({ success: true, count: results.length, data: results });
}

/**
 * GET /api/batches/filter?sheet=benefits|tax
 * Filter batches by sheet.
 */
async function filterBatches(req, res) {
  const { sheet } = req.query;
  await excelService.syncFromDisk(sheet);
  const results = excelService.filter({
    sheetSource: sheet,
  });
  res.json({ success: true, count: results.length, data: results });
}

/**
 * GET /api/batches/:name?sheet=benefits|tax
 * Returns a single batch by batchName (URL-encoded).
 * NOTE: registered AFTER /summary, /search, /filter in batchRoutes.js
 */
async function getBatchByName(req, res) {
  const name  = decodeURIComponent(req.params.name);
  const sheet = req.query.sheet || undefined;
  await excelService.syncFromDisk(sheet);
  const batch = excelService.getByName(name, sheet);
  if (!batch) {
    const err = new Error(`Batch "${name}" not found.`);
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: batch });
}

// ── SSH log helpers ───────────────────────────────────────────────────────────

/**
 * Extracts the value of ACTUAL_BATCH_NAME from a batch arguments string.
 *
 * Arguments may be separated by whitespace or by "###" (the delimiter used
 * in the batch arguments field, e.g.
 *   "ACTUAL_BATCH_NAME=BatchOIGFetchTaxReportData###DaccessBatch.runMode=M").
 * Splits on any combination of whitespace and "#" characters before scanning
 * tokens, so the extracted value contains only the batch name itself.
 *
 * Returns the extracted value, or null if the argument is absent.
 *
 * @param {string} args  - The batch arguments string
 * @returns {string|null}
 */
function extractActualBatchName(args) {
  if (!args) return null;
  const tokens = args.split(/[\s#]+/);
  for (const token of tokens) {
    const match = token.match(/^ACTUAL_BATCH_NAME=(.+)$/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Resolves the full remote log directory for a batch.
 *
 * batch.logDir is stored as a shell "cd" command string from SHEET_LOG_PATHS:
 *   e.g. "cd /opt/app/accessms/bin/benefits/batch"
 *
 * The actual per-batch log directory on the server is:
 *   <base>/logs/<batchName>
 *   e.g. /opt/app/accessms/bin/benefits/batch/logs/BatchGetDd214Response
 *
 * When the batch arguments contain ACTUAL_BATCH_NAME=<value>, that value is
 * used as the log subdirectory instead of batchName, reflecting the folder
 * structure that was already created on the server under that name:
 *   <base>/logs/<actualBatchName>
 *
 * @param {Object} batch
 * @returns {string}  Absolute path to the batch's log directory
 */
function resolveBatchLogDir(batch) {
  // Strip the leading "cd " if present, then trim slashes
  const base = batch.logDir.replace(/^cd\s+/i, '').trim().replace(/\/+$/, '');
  const actualBatchName = extractActualBatchName(batch.arguments);
  const subDir = actualBatchName || batch.batchName;
  return `${base}/logs/${subDir}`;
}

/**
 * Shared logic: resolve batch, derive log directory, send response as plain text.
 * @param {Object} req
 * @param {Object} res
 * @param {'today'|'error'} logType
 */
async function _serveBatchLog(req, res, logType) {
  const name  = decodeURIComponent(req.params.name);
  const sheet = req.query.sheet || undefined;
  const lines = req.query.lines ? Number(req.query.lines) : undefined;

  await excelService.syncFromDisk(sheet);
  const batch = excelService.getByName(name, sheet);
  if (!batch) {
    const err = new Error(`Batch "${name}" not found.`);
    err.status = 404;
    throw err;
  }

  if (!batch.logDir) {
    const err = new Error(`Batch "${name}" has no log directory configured.`);
    err.status = 422;
    throw err;
  }

  const logDir = resolveBatchLogDir(batch);

  // When ACTUAL_BATCH_NAME is present in arguments, both the log directory
  // and the log filename on the server use that name — pass it through so
  // the SSH fetch constructs the correct filename (not the schedule entry name).
  const actualBatchName = extractActualBatchName(batch.arguments);
  const logBatchName    = actualBatchName || batch.batchName;

  const logContent = logType === 'error'
    ? await sshService.fetchErrorLog(logDir, logBatchName, batch.scheduleName, lines)
    : await sshService.fetchTodayLog(logDir, logBatchName, lines);

  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(logContent);
}

/**
 * GET /api/batches/:name/logs?sheet=benefits|tax&lines=500
 * Fetches today's dated log file:  <BatchName><MM-DD-YYYY>.log
 */
async function getBatchLogs(req, res) {
  return _serveBatchLog(req, res, 'today');
}

/**
 * GET /api/batches/:name/error-logs?sheet=benefits|tax&lines=500
 * Fetches the Bus Error log file:  *<BatchName>*_Bus_Error.log
 */
async function getBatchErrorLogs(req, res) {
  return _serveBatchLog(req, res, 'error');
}

module.exports = { getAllBatches, getSummary, searchBatches, filterBatches, getBatchByName, getBatchLogs, getBatchErrorLogs };
