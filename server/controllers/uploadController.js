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
  'application/vnd.ms-excel.sheet.macroenabled.12',                   // .xlsm
  'application/vnd.ms-excel.sheet.binary.macroenabled.12',            // .xlsb
  'application/vnd.oasis.opendocument.spreadsheet',                  // .ods
  'application/octet-stream',                                          // generic binary / Windows/browser upload fallback
  'application/x-excel',
  'application/x-msexcel',
  'text/csv',                                                          // .csv
  'application/csv',                                                   // .csv
  'text/plain',                                                        // text / csv fallback
]);

const VALID_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.csv'];

/**
 * POST /api/batches/upload/:sheet
 * Multer middleware must run before this handler (see batchRoutes.js).
 */
async function uploadSheet(req, res) {
  const { sheet } = req.params;

  console.log(`[uploadController] Received upload request for sheet: "${sheet}"`);

  // Validate sheet param
  if (sheet !== 'benefits' && sheet !== 'tax') {
    console.error(`[uploadController] Invalid sheet parameter: "${sheet}"`);
    const err = new Error('Invalid sheet. Must be "benefits" or "tax".');
    err.status = 400;
    throw err;
  }

  // Validate file presence
  if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
    console.error(`[uploadController] No file or empty buffer received for sheet: "${sheet}"`);
    const err = new Error('No file provided. Send a valid Excel (.xlsx, .xls, .xlsm, .xlsb) or CSV file in the "file" field.');
    err.status = 400;
    throw err;
  }

  const mime = (req.file.mimetype || '').toLowerCase();
  const originalName = req.file.originalname || 'unknown';
  const lowerName = originalName.toLowerCase();
  const hasValidExt = VALID_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

  console.log(`[uploadController] File details: name="${originalName}", size=${req.file.size || req.file.buffer.length} bytes, mime="${mime}"`);

  if (!ALLOWED_MIME_TYPES.has(mime) && !hasValidExt) {
    console.error(`[uploadController] Rejected unsupported file format: mime="${mime}", name="${originalName}"`);
    const err = new Error(
      `Invalid file format "${originalName}". Only Excel (.xlsx, .xls, .xlsm, .xlsb) and CSV files are accepted.`
    );
    err.status = 400;
    throw err;
  }

  // Parse buffer and hot-reload the sheet in the store
  console.log(`[uploadController] Processing buffer through universal parser pipeline for "${sheet}"...`);
  const { count, warnings } = await excelService.reloadSheet(sheet, req.file.buffer);
  console.log(`[uploadController] Successfully processed and reloaded "${sheet}": ${count} batch(es) loaded.`);

  res.status(201).json({
    success:  true,
    sheet,
    count,
    warnings: warnings.length ? warnings : undefined,
    message:  `"${sheet}" sheet reloaded successfully — ${count} batch(es) loaded.`,
  });
}

module.exports = { uploadSheet };
