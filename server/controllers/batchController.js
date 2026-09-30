/**
 * batchController.js — request handlers for all batch-related endpoints.
 *
 * Each method is a thin orchestration layer:
 *   validate input → call service → format response
 * No business logic lives here.
 */

const excelService = require('../services/excelService');

/**
 * GET /api/batches?sheet=benefits|tax
 * Returns all batches, optionally filtered by sheetSource.
 */
function getAllBatches(req, res) {
  const sheet   = req.query.sheet || undefined;
  const batches = excelService.getAll(sheet);
  res.json({ success: true, count: batches.length, data: batches });
}

/**
 * GET /api/batches/summary
 * Returns aggregated summary stats for dashboard cards.
 */
function getSummary(req, res) {
  const summary = excelService.getSummary();
  res.json({ success: true, data: summary });
}

/**
 * GET /api/batches/search?q=<query>&sheet=benefits|tax
 * Full-text search across batchName, scheduleName, and arguments.
 */
function searchBatches(req, res) {
  const q     = (req.query.q || '').trim();
  const sheet = req.query.sheet || undefined;
  if (!q) {
    return res.json({ success: true, count: 0, data: [] });
  }
  const results = excelService.search(q, sheet);
  res.json({ success: true, count: results.length, data: results });
}

/**
 * GET /api/batches/filter?sheet=benefits|tax&scheduleValid=true|false
 * Filter batches by sheet and/or schedule validity.
 */
function filterBatches(req, res) {
  const { sheet, scheduleValid } = req.query;
  const results = excelService.filter({
    sheetSource:   sheet,
    scheduleValid: scheduleValid,
  });
  res.json({ success: true, count: results.length, data: results });
}

/**
 * GET /api/batches/:name?sheet=benefits|tax
 * Returns a single batch by batchName (URL-encoded).
 * NOTE: registered AFTER /summary, /search, /filter in batchRoutes.js
 */
function getBatchByName(req, res) {
  const name  = decodeURIComponent(req.params.name);
  const sheet = req.query.sheet || undefined;
  const batch = excelService.getByName(name, sheet);
  if (!batch) {
    const err = new Error(`Batch "${name}" not found.`);
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: batch });
}

/**
 * POST /api/upload
 * Accepts a multipart/form-data Excel file upload.
 * The multer middleware (configured in routes) attaches req.file.
 * On success, reloads the in-memory store from the uploaded file.
 */
async function uploadExcel(req, res) {
  if (!req.file) {
    const err = new Error('No file uploaded. Send a .xlsx file in the "file" field.');
    err.status = 400;
    throw err;
  }

  const { count, warnings } = await excelService.loadFromFile(req.file.path);
  res.json({
    success: true,
    message: `File uploaded and processed. ${count} batch(es) loaded.`,
    warnings,
    count,
  });
}

module.exports = { getAllBatches, getSummary, searchBatches, filterBatches, getBatchByName, uploadExcel };
