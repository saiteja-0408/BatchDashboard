/**
 * excelService.js — in-memory batch data store + reload logic.
 *
 * Acts as the data-access layer between the file parser and the controller.
 * Holds the parsed batch list in memory so API requests don't re-read the file
 * on every call. Call loadFromFile() to refresh the store (startup or after upload).
 */

const { parseExcelFile } = require('../utils/fileParser');
const { createBatch, validateBatch } = require('../models/batchModel');
const { ACTIVE_STATUSES } = require('../config/constants');

/**
 * In-memory store. Mutated only by loadFromFile().
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
  // parseExcelFile is async (ExcelJS uses async file I/O)
  const { rows, warnings } = await parseExcelFile(filePath);

  if (warnings.length > 0) {
    warnings.forEach((w) => console.warn(`[excelService] WARNING: ${w}`));
  }

  const batches = [];
  for (const row of rows) {
    const batch = createBatch(row);
    const batchWarnings = validateBatch(batch);
    batchWarnings.forEach((w) => console.warn(`[excelService] VALIDATION: ${w}`));
    if (batch.batchId) batches.push(batch); // only store rows with an ID
  }

  _store = batches;
  console.log(`[excelService] Store loaded: ${_store.length} batch(es).`);
  return { count: _store.length, warnings };
}

/**
 * Returns a shallow copy of the in-memory store.
 * @returns {import('../models/batchModel').BatchModel[]}
 */
function getAll() {
  return [..._store];
}

/**
 * Finds a single batch by its batchId.
 * @param {string} id
 * @returns {import('../models/batchModel').BatchModel | undefined}
 */
function getById(id) {
  return _store.find((b) => b.batchId === id);
}

/**
 * Full-text search across all string fields.
 * Case-insensitive substring match.
 * @param {string} query
 * @returns {import('../models/batchModel').BatchModel[]}
 */
function search(query) {
  const q = query.toLowerCase();
  return _store.filter((b) =>
    Object.values(b).some(
      (v) => typeof v === 'string' && v.toLowerCase().includes(q)
    )
  );
}

/**
 * Filters the store by optional domain, frequency, and status criteria.
 * All provided filters are applied as AND conditions.
 *
 * @param {{ domain?: string, frequency?: string, status?: string }} filters
 * @returns {import('../models/batchModel').BatchModel[]}
 */
function filter(filters) {
  return _store.filter((b) => {
    if (filters.domain    && b.domain.toLowerCase()        !== filters.domain.toLowerCase())    return false;
    if (filters.frequency && b.frequency.toLowerCase()     !== filters.frequency.toLowerCase()) return false;
    if (filters.status    && b.lastRunStatus.toLowerCase() !== filters.status.toLowerCase())    return false;
    return true;
  });
}

/**
 * Computes summary statistics for the dashboard cards.
 * @returns {Object}
 */
function getSummary() {
  const total = _store.length;
  const active = _store.filter((b) => b.isActive).length;
  const inactive = total - active;

  const byDomain = _store.reduce((acc, b) => {
    acc[b.domain] = (acc[b.domain] || 0) + 1;
    return acc;
  }, {});

  const byStatus = _store.reduce((acc, b) => {
    acc[b.lastRunStatus] = (acc[b.lastRunStatus] || 0) + 1;
    return acc;
  }, {});

  // "Running today" = lastRunStatus is Running or lastRunTime is today's date
  const today = new Date().toDateString();
  const runningToday = _store.filter((b) => {
    if (b.lastRunStatus === 'Running') return true;
    if (!b.lastRunTime) return false;
    try { return new Date(b.lastRunTime).toDateString() === today; }
    catch { return false; }
  }).length;

  const failed = _store.filter((b) => b.lastRunStatus === 'Failed').length;

  return { total, active, inactive, byDomain, byStatus, runningToday, failed };
}

module.exports = { loadFromFile, getAll, getById, search, filter, getSummary };
