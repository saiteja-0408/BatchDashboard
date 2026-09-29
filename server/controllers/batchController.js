/**
 * batchController.js — request handlers for all batch-related endpoints.
 *
 * Each method is a thin orchestration layer:
 *   validate input → call service → format response
 * No business logic lives here.
 */

const excelService = require('../services/excelService');

/**
 * GET /api/batches
 * Returns all batches in the store.
 */
function getAllBatches(req, res) {
  const batches = excelService.getAll();
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
 * GET /api/batches/search?q=<query>
 * Full-text search across all batch fields.
 */
function searchBatches(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.json({ success: true, count: 0, data: [] });
  }
  const results = excelService.search(q);
  res.json({ success: true, count: results.length, data: results });
}

/**
 * GET /api/batches/filter?domain=&frequency=&status=
 * Filter batches by domain, frequency, and/or last run status.
 */
function filterBatches(req, res) {
  const { domain, frequency, status } = req.query;
  const results = excelService.filter({ domain, frequency, status });
  res.json({ success: true, count: results.length, data: results });
}

/**
 * GET /api/batches/:id
 * Returns a single batch by Batch_ID.
 * NOTE: This route must be registered AFTER /search and /filter to prevent
 * those path segments from being matched as :id parameters.
 */
function getBatchById(req, res) {
  const batch = excelService.getById(req.params.id);
  if (!batch) {
    const err = new Error(`Batch with ID "${req.params.id}" not found.`);
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

module.exports = { getAllBatches, getSummary, searchBatches, filterBatches, getBatchById, uploadExcel };
