/**
 * excelService.js — in-memory batch data store + reload logic.
 *
 * The store holds batches from both sheets (Benefits + Tax).
 * batchName is used as the unique key within a sheet.
 * sheetSource ('benefits' | 'tax') is used for sheet-level filtering.
 *
 * Three load entry-points:
 *   loadFromFiles(benefitsPath, taxPath) — used at server startup,
 *     reads both dedicated files and merges them into one store.
 *   loadFromFile(filePath) — kept for tests; loads a single file
 *     (which may contain both sheets) and replaces the store.
 *   reloadSheet(sheetSource, buffer) — hot-replaces one sheet's slice
 *     in the store from an in-memory Buffer (used by the upload endpoint).
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { parseExcelFile, parseExcelBuffer } = require('../utils/fileParser');
const { createBatch, validateBatch } = require('../models/batchModel');

/**
 * In-memory store and file tracking.
 * @type {import('../models/batchModel').BatchModel[]}
 */
let _store = [];
let _benefitsPath = null;
let _taxPath = null;
let _fileMtimes = {
  benefits: 0,
  tax: 0,
};

/**
 * Resolves configured or default file path for a given sheet ('benefits' | 'tax').
 * Uses cross-platform path.resolve and path.join.
 * @param {'benefits'|'tax'} sheetSource
 * @returns {string}
 */
function getTargetFilePath(sheetSource) {
  if (sheetSource === 'benefits') {
    if (process.env.BENEFITS_EXCEL_PATH) return path.resolve(process.env.BENEFITS_EXCEL_PATH);
    if (_benefitsPath) return _benefitsPath;
    const dataDir = path.resolve(process.env.DATA_DIR || './data');
    return path.join(dataDir, 'benefits.xlsx');
  }
  if (sheetSource === 'tax') {
    if (process.env.TAX_EXCEL_PATH) return path.resolve(process.env.TAX_EXCEL_PATH);
    if (_taxPath) return _taxPath;
    const dataDir = path.resolve(process.env.DATA_DIR || './data');
    return path.join(dataDir, 'tax.xlsx');
  }
  const dataDir = path.resolve(process.env.DATA_DIR || './data');
  return path.join(dataDir, `${sheetSource}.xlsx`);
}

/**
 * Checks if on-disk file has been replaced/updated since last load and reloads it automatically.
 * Ensures swapping benefits.xlsx or tax.xlsx immediately reflects in all read operations.
 * @param {'benefits'|'tax'} [sheetSource]
 */
// Helper for syncing modified files is handled asynchronously in syncFromDisk

/**
 * Internal helper: parses one file, validates rows, and returns a BatchModel[].
 * Does NOT mutate _store.
 *
 * @param {string} filePath
 * @param {'benefits'|'tax'|null} [defaultSheetSource=null]
 * @returns {Promise<{ batches: import('../models/batchModel').BatchModel[], warnings: string[] }>}
 */
async function _parseToBatches(filePath, defaultSheetSource = null) {
  const { rows, warnings } = await parseExcelFile(filePath, defaultSheetSource);

  if (warnings.length > 0) {
    warnings.forEach((w) => console.warn(`[excelService] WARNING: ${w}`));
  }

  const batches = [];
  for (const row of rows) {
    const batch         = createBatch(row);
    const batchWarnings = validateBatch(batch);
    batchWarnings.forEach((w) => console.warn(`[excelService] VALIDATION: ${w}`));
    if (batch.batchName) batches.push(batch);
  }

  return { batches, warnings };
}

/**
 * Loads Benefits and Tax data from two separate Excel files and merges them
 * into the in-memory store. This is the primary entry-point used at server startup.
 *
 * @param {string} benefitsPath - Absolute path to benefits.xlsx
 * @param {string} taxPath      - Absolute path to tax.xlsx
 * @returns {Promise<{ count: number, warnings: string[] }>}
 */
async function loadFromFiles(benefitsPath, taxPath) {
  _benefitsPath = benefitsPath ? path.resolve(benefitsPath) : getTargetFilePath('benefits');
  _taxPath      = taxPath ? path.resolve(taxPath) : getTargetFilePath('tax');

  const allWarnings = [];

  const [benefitsResult, taxResult] = await Promise.all([
    _parseToBatches(_benefitsPath, 'benefits').catch((err) => {
      allWarnings.push(`benefits.xlsx: ${err.message}`);
      return { batches: [], warnings: [] };
    }),
    _parseToBatches(_taxPath, 'tax').catch((err) => {
      allWarnings.push(`tax.xlsx: ${err.message}`);
      return { batches: [], warnings: [] };
    }),
  ]);

  allWarnings.push(...benefitsResult.warnings, ...taxResult.warnings);

  _store = [...benefitsResult.batches, ...taxResult.batches];

  try {
    if (fs.existsSync(_benefitsPath)) {
      const s = fs.statSync(_benefitsPath);
      _fileMtimes.benefits = `${s.mtimeMs}:${s.size}`;
    }
    if (fs.existsSync(_taxPath)) {
      const s = fs.statSync(_taxPath);
      _fileMtimes.tax = `${s.mtimeMs}:${s.size}`;
    }
  } catch {
    // Ignore stat failures
  }

  const bCount = _store.filter((b) => b.sheetSource === 'benefits').length;
  const tCount = _store.filter((b) => b.sheetSource === 'tax').length;
  console.log(`[excelService] Store loaded: ${_store.length} batch(es) — ${bCount} Benefits, ${tCount} Tax.`);
  return { count: _store.length, warnings: allWarnings };
}

/**
 * Checks if on-disk files have changed and hot-syncs them into the store before serving requests.
 * LOG-24: also forces a reload when mtime equals the stored value but size has changed,
 * which covers the "replace with same mtime" edge case on FAT/NTFS or NFS mounts with
 * coarse timestamp granularity. We combine mtime + size as the change fingerprint.
 * @param {'benefits'|'tax'} [sheetSource]
 */
async function syncFromDisk(sheetSource) {
  // If in test environment or custom fixture mode where single file was loaded, do not override store
  if (process.env.NODE_ENV === 'test' && !_benefitsPath) {
    return;
  }

  const sources = sheetSource ? [sheetSource] : ['benefits', 'tax'];
  for (const src of sources) {
    const filePath = getTargetFilePath(src);
    try {
      if (fs.existsSync(filePath)) {
        const stat  = fs.statSync(filePath);
        const fingerprint = `${stat.mtimeMs}:${stat.size}`;
        if (fingerprint !== (_fileMtimes[src] || '')) {
          const { batches } = await _parseToBatches(filePath, src);
          if (batches.length > 0) {
            _store = [
              ..._store.filter((b) => b.sheetSource !== src),
              ...batches,
            ];
            _fileMtimes[src] = fingerprint;
            console.log(`[excelService] Hot-reloaded modified file for "${src}" from ${filePath} (${batches.length} rows).`);
          }
        }
      }
    } catch (e) {
      console.warn(`[excelService] Failed to hot-reload ${src}: ${e.message}`);
    }
  }
}

/**
 * Parses a single Excel file and replaces the in-memory store.
 * Kept for use in tests (which load data/batches.xlsx as a fixture).
 *
 * @param {string} filePath - Absolute path to the .xlsx file
 * @returns {Promise<{ count: number, warnings: string[] }>}
 */
async function loadFromFile(filePath) {
  const { batches, warnings } = await _parseToBatches(filePath);

  _store = batches;
  _benefitsPath = null;
  _taxPath = null;
  _fileMtimes = { benefits: Infinity, tax: Infinity };
  const bCount = _store.filter((b) => b.sheetSource === 'benefits').length;
  const tCount = _store.filter((b) => b.sheetSource === 'tax').length;
  console.log(`[excelService] Store loaded: ${_store.length} batch(es) — ${bCount} Benefits, ${tCount} Tax.`);
  return { count: _store.length, warnings };
}

/**
 * Returns a shallow copy of the in-memory store.
 * Optionally filtered by sheetSource.
 * @param {'benefits'|'tax'|undefined} sheetSource
 * @returns {import('../models/batchModel').BatchModel[]}
 */
function getAll(sheetSource) {
  if (sheetSource) return _store.filter((b) => b.sheetSource === sheetSource);
  return [..._store];
}

/**
 * Finds a single batch by batchName within an optional sheet.
 * batchName is URL-encoded in the route; decode before comparing.
 * @param {string} name
 * @param {string|undefined} sheetSource
 * @returns {import('../models/batchModel').BatchModel | undefined}
 */
function getByName(name, sheetSource) {
  return _store.find((b) =>
    b.batchName === name &&
    (!sheetSource || b.sheetSource === sheetSource)
  );
}

/**
 * Full-text search across batchName, scheduleName, and arguments.
 * @param {string} query
 * @param {string|undefined} sheetSource
 * @returns {import('../models/batchModel').BatchModel[]}
 */
function search(query, sheetSource) {
  const q = query.toLowerCase();
  return _store.filter((b) => {
    if (sheetSource && b.sheetSource !== sheetSource) return false;
    return (
      b.batchName.toLowerCase().includes(q)    ||
      b.scheduleName.toLowerCase().includes(q) ||
      b.arguments.toLowerCase().includes(q)
    );
  });
}

/**
 * Filters the store by sheetSource.
 * @param {{ sheetSource?: string }} filters
 * @returns {import('../models/batchModel').BatchModel[]}
 */
function filter(filters) {
  return _store.filter((b) => {
    if (filters.sheetSource && b.sheetSource !== filters.sheetSource) return false;
    return true;
  });
}

/**
 * Computes summary statistics for the dashboard cards.
 * LOG-22: invalid count is now computed from rows missing batchName or scheduleName.
 * @returns {Object}
 */
function getSummary() {
  const total    = _store.length;
  const benefits = _store.filter((b) => b.sheetSource === 'benefits').length;
  const tax      = _store.filter((b) => b.sheetSource === 'tax').length;
  const invalid  = _store.filter((b) => !b.batchName || !b.scheduleName).length;

  const bySheet = { Benefits: benefits, Tax: tax };

  return { total, benefits, tax, invalid, bySheet };
}

/**
 * Hot-replaces a single sheet's records in the in-memory store from a Buffer.
 * Used by the POST /api/batches/upload endpoint when a user uploads a new file.
 *
 * The uploaded file must contain at least one sheet whose name matches the
 * given sheetSource ('benefits' → sheet name contains "benefit",
 * 'tax' → sheet name contains "tax").
 *
 * After a successful reload the in-memory store for the given sheet is replaced
 * atomically; the other sheet is left untouched.
 *
 * @param {'benefits'|'tax'} sheetSource
 * @param {Buffer} buffer - raw .xlsx/.xls file contents
 * @returns {Promise<{ count: number, warnings: string[] }>}
 */
/**
 * Serialised write queue — ensures concurrent uploads to the same or different
 * sheet sources are never interleaved on disk (LOG-13).
 */
let _writeQueue = Promise.resolve();

async function reloadSheet(sheetSource, buffer) {
  const { batches, warnings } = await _parseToBatchesFromBuffer(buffer, sheetSource);

  // LOG-14: assert batchName uniqueness within this sheet before committing to store
  const seen = new Set();
  const duplicates = [];
  for (const b of batches) {
    if (seen.has(b.batchName)) duplicates.push(b.batchName);
    seen.add(b.batchName);
  }
  if (duplicates.length > 0) {
    console.warn(`[excelService] Duplicate batchNames in uploaded "${sheetSource}" file: ${duplicates.join(', ')}`);
  }

  // Ensure all incoming batches belong to the requested sheetSource and have the right logDir
  const incoming = batches.map((b) => ({
    ...b,
    sheetSource,
    logDir: b.logDir || (sheetSource === 'tax' ? 'cd /opt/app/accessms/bin/tax/batch/' : 'cd /opt/app/accessms/bin/benefits/batch'),
  }));

  if (incoming.length === 0) {
    const err = new Error(
      `Uploaded file contains no valid batch rows for the "${sheetSource}" sheet. ` +
      'Make sure the first sheet contains valid data rows with batch job entries.'
    );
    err.status = 422;
    throw err;
  }

  // Atomically replace only the target sheet's rows; preserve the other sheet
  _store = [
    ..._store.filter((b) => b.sheetSource !== sheetSource),
    ...incoming,
  ];

  // LOG-12/LOG-13: atomic write (tmp → rename) serialised through _writeQueue
  // so concurrent uploads never interleave or corrupt the target file.
  _writeQueue = _writeQueue.then(async () => {
    try {
      const targetFile = getTargetFilePath(sheetSource);
      const targetDir  = path.dirname(targetFile);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      // Write to a temp file first, then rename atomically
      const tmpFile = path.join(os.tmpdir(), `batch_upload_${sheetSource}_${Date.now()}.tmp`);
      fs.writeFileSync(tmpFile, buffer);
      fs.renameSync(tmpFile, targetFile);
      const s = fs.statSync(targetFile);
      _fileMtimes[sheetSource] = `${s.mtimeMs}:${s.size}`;
    } catch (fsErr) {
      console.warn(`[excelService] Warning: Could not persist uploaded sheet to disk: ${fsErr.message}`);
    }
  });
  // Fire-and-forget — do not block the HTTP response on the disk write
  _writeQueue.catch((e) => console.warn(`[excelService] Write queue error: ${e.message}`));

  const bCount = _store.filter((b) => b.sheetSource === 'benefits').length;
  const tCount = _store.filter((b) => b.sheetSource === 'tax').length;
  console.log(
    `[excelService] Reloaded "${sheetSource}" sheet from upload: ` +
    `${incoming.length} row(s). Store now: ${_store.length} total ` +
    `(${bCount} Benefits, ${tCount} Tax).`
  );
  return { count: incoming.length, warnings };
}

/**
 * Internal helper: parses a raw Buffer (instead of a file path), validates
 * rows, and returns a BatchModel[]. Does NOT mutate _store.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{ batches: import('../models/batchModel').BatchModel[], warnings: string[] }>}
 */
async function _parseToBatchesFromBuffer(buffer, defaultSheetSource) {
  const { rows, warnings } = await parseExcelBuffer(buffer, defaultSheetSource);

  if (warnings.length > 0) {
    warnings.forEach((w) => console.warn(`[excelService] WARNING: ${w}`));
  }

  const batches = [];
  for (const row of rows) {
    const batch         = createBatch(row);
    const batchWarnings = validateBatch(batch);
    batchWarnings.forEach((w) => console.warn(`[excelService] VALIDATION: ${w}`));
    if (batch.batchName) batches.push(batch);
  }

  return { batches, warnings };
}

module.exports = { loadFromFiles, loadFromFile, reloadSheet, getAll, getByName, search, filter, getSummary, syncFromDisk, getTargetFilePath };
