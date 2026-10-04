/**
 * uploadController.js — handles POST /api/batches/upload/:sheet
 *
 * Accepts a multipart/form-data request with a single .xlsx/.xls file field
 * named "file". Parses the file from the in-memory Buffer provided by multer
 * (no temp file is written to disk) and hot-reloads the target sheet in the
 * in-memory batch store.
 *
 * Route parameter :sheet must be 'benefits' or 'tax'.
 *
 * Responses:
 *   201 — upload parsed and store reloaded successfully
 *   400 — no file provided, wrong MIME type, or invalid sheet param
 *   422 — file parsed but contained no rows for the target sheet
 *   500 — unexpected parse/load error
 */

'use strict';

const excelService = require('../services/excelService');

const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                          // .xls
  'application/octet-stream',                                          // some browsers send this
  'text/csv',                                                          // .csv
  'application/csv',                                                   // .csv
  'text/plain',                                                        // some OS/browsers report csv as text/plain
]);

/**
 * POST /api/batches/upload/:sheet
 * Multer middleware must run before this handler (see batchRoutes.js).
 */
async function uploadSheet(req, res) {
  const { sheet } = req.params;

  // Validate sheet param
  if (sheet !== 'benefits' && sheet !== 'tax') {
    const err = new Error('Invalid sheet. Must be "benefits" or "tax".');
    err.status = 400;
    throw err;
  }

  // Validate file presence
  if (!req.file) {
    const err = new Error('No file provided. Send a .xlsx or .xls file as "file" field.');
    err.status = 400;
    throw err;
  }

  // Loose MIME check — primarily rely on extension + ExcelJS parse failure
  const mime = (req.file.mimetype || '').toLowerCase();
  const name = (req.file.originalname || '').toLowerCase();
  const validExt = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');
  if (!ALLOWED_MIME_TYPES.has(mime) && !validExt) {
    const err = new Error(
      `Invalid file type "${req.file.mimetype}". Only .xlsx, .xls, and .csv files are accepted.`
    );
    err.status = 400;
    throw err;
  }

  // Parse buffer and hot-reload the sheet in the store
  const { count, warnings } = await excelService.reloadSheet(sheet, req.file.buffer);

  res.status(201).json({
    success:  true,
    sheet,
    count,
    warnings: warnings.length ? warnings : undefined,
    message:  `"${sheet}" sheet reloaded successfully — ${count} batch(es) loaded.`,
  });
}

module.exports = { uploadSheet };
