/**
 * excelService.js — in-memory batch data store + reload logic.
 *
 * The store now holds batches from both sheets (Benefits + Tax).
 * batchName is used as the unique key within a sheet.
 * sheetSource ('benefits' | 'tax') is used for sheet-level filtering.
 */

const { parseExcelFile } = require('../utils/fileParser');
const { createBatch, validateBatch } = require('../models/batchModel');

/**
 * In-memory store.
 * @type {import('../models/batchModel').BatchModel[]}
 */
let _store = [];

/**
 * Parses the given Excel file and replaces the in-memory store.
 * Logs all warnings and validation issues to the server console.
 *
 * @param {string} filePath - Absolute path to the .xlsx file
 * @returns {Promise<{ count: number, warnings: string[] }>}
 */
async function loadFromFile(filePath) {
  const { rows, warnings } = await parseExcelFile(filePath);

  if (warnings.length > 0) {
    warnings.forEach((w) => console.warn(`[excelService] WARNING: ${w}`));
  }

  const batches = [];
  for (const row of rows) {
    const batch        = createBatch(row);
    const batchWarnings = validateBatch(batch);
    // Validation warnings are informational — all rows with a batchName are stored
    batchWarnings.forEach((w) => console.warn(`[excelService] VALIDATION: ${w}`));
    if (batch.batchName) batches.push(batch);
  }

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

module.exports = { loadFromFile, getAll, getByName, search, filter, getSummary };
