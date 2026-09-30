/**
 * excelService.js — in-memory batch data store + reload logic.
 *
 * The store holds batches from both sheets (Benefits + Tax).
 * batchName is used as the unique key within a sheet.
 * sheetSource ('benefits' | 'tax') is used for sheet-level filtering.
 *
 * Two load entry-points:
 *   loadFromFiles(benefitsPath, taxPath) — used at server startup,
 *     reads both dedicated files and merges them into one store.
 *   loadFromFile(filePath) — kept for tests; loads a single file
 *     (which may contain both sheets) and replaces the store.
 */

const { parseExcelFile } = require('../utils/fileParser');
const { createBatch, validateBatch } = require('../models/batchModel');

/**
 * In-memory store.
 * @type {import('../models/batchModel').BatchModel[]}
 */
let _store = [];

/**
 * Internal helper: parses one file, validates rows, and returns a BatchModel[].
 * Does NOT mutate _store.
 *
 * @param {string} filePath
 * @returns {Promise<{ batches: import('../models/batchModel').BatchModel[], warnings: string[] }>}
 */
async function _parseToBatches(filePath) {
  const { rows, warnings } = await parseExcelFile(filePath);

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
  const allWarnings = [];

  const [benefitsResult, taxResult] = await Promise.all([
    _parseToBatches(benefitsPath).catch((err) => {
      allWarnings.push(`benefits.xlsx: ${err.message}`);
      return { batches: [], warnings: [] };
    }),
    _parseToBatches(taxPath).catch((err) => {
      allWarnings.push(`tax.xlsx: ${err.message}`);
      return { batches: [], warnings: [] };
    }),
  ]);

  allWarnings.push(...benefitsResult.warnings, ...taxResult.warnings);

  _store = [...benefitsResult.batches, ...taxResult.batches];
  const bCount = _store.filter((b) => b.sheetSource === 'benefits').length;
  const tCount = _store.filter((b) => b.sheetSource === 'tax').length;
  console.log(`[excelService] Store loaded: ${_store.length} batch(es) — ${bCount} Benefits, ${tCount} Tax.`);
  return { count: _store.length, warnings: allWarnings };
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
 * Filters the store by sheetSource and/or scheduleValid flag.
 * @param {{ sheetSource?: string, scheduleValid?: string }} filters
 * @returns {import('../models/batchModel').BatchModel[]}
 */
function filter(filters) {
  return _store.filter((b) => {
    if (filters.sheetSource && b.sheetSource !== filters.sheetSource) return false;
    // scheduleValid filter: 'true' | 'false'
    if (filters.scheduleValid !== undefined && filters.scheduleValid !== '') {
      const expected = filters.scheduleValid === 'true';
      if (b.scheduleValid !== expected) return false;
    }
    return true;
  });
}

/**
 * Computes summary statistics for the dashboard cards.
 * @returns {Object}
 */
function getSummary() {
  const total    = _store.length;
  const benefits = _store.filter((b) => b.sheetSource === 'benefits').length;
  const tax      = _store.filter((b) => b.sheetSource === 'tax').length;
  const invalid  = _store.filter((b) => !b.scheduleValid).length;

  const bySheet = { Benefits: benefits, Tax: tax };

  const byScheduleValidity = {
    Valid:   total - invalid,
    Invalid: invalid,
  };

  return { total, benefits, tax, invalid, bySheet, byScheduleValidity };
}

module.exports = { loadFromFiles, loadFromFile, getAll, getByName, search, filter, getSummary };
