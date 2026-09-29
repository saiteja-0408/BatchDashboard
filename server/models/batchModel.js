/**
 * batchModel.js — defines the canonical batch data shape and validation helpers.
 *
 * This is the single source of truth for what a "batch" object looks like
 * inside the application. The Excel parser maps raw rows → BatchModel instances.
 */

const { ACTIVE_STATUSES } = require('../config/constants');

/**
 * @typedef {Object} BatchModel
 * @property {string}  batchId         - Unique identifier (Batch_ID column)
 * @property {string}  batchName       - Human-readable name
 * @property {string}  description     - Purpose / description
 * @property {string}  domain          - "Benefits" | "Tax"
 * @property {string}  frequency       - "Daily" | "Weekly" | "Monthly" | "Ad-hoc"
 * @property {string}  scheduleTime    - HH:MM or cron expression
 * @property {string|null} lastRunTime - ISO string or raw date string from Excel
 * @property {string|null} nextRunTime - ISO string or raw date string from Excel
 * @property {string}  lastRunStatus   - "Success" | "Failed" | "Running" | "Skipped"
 * @property {string}  environment     - "DEV" | "QA" | "PROD"
 * @property {string}  ownerTeam       - Team responsible for this batch
 * @property {string}  startCommand    - Shell command to start the batch
 * @property {string}  stopCommand     - Shell command to stop the batch
 * @property {string}  statusCommand   - Shell command to check batch status
 * @property {string}  logPath         - Path to log file
 * @property {string}  configPath      - Path to config file
 * @property {string}  notes           - Free-form notes
 * @property {boolean} isActive        - Derived: true if lastRunStatus in ACTIVE_STATUSES
 */

/**
 * Normalises a raw parsed row object into a well-typed BatchModel.
 * Unknown or missing fields are coerced to empty strings rather than left undefined,
 * so the frontend never has to guard against undefined field access.
 *
 * @param {Object} raw  - Object with internal field names (after column mapping)
 * @returns {BatchModel}
 */
function createBatch(raw) {
  const safeStr = (v) => (v === undefined || v === null ? '' : String(v).trim());
  const safeDate = (v) => {
    if (!v) return null;
    // Excel dates may come as JS Date objects (xlsx library converts serial dates)
    if (v instanceof Date) return v.toISOString();
    return safeStr(v);
  };

  const batch = {
    batchId:       safeStr(raw.batchId),
    batchName:     safeStr(raw.batchName),
    description:   safeStr(raw.description),
    domain:        safeStr(raw.domain),
    frequency:     safeStr(raw.frequency),
    scheduleTime:  safeStr(raw.scheduleTime),
    lastRunTime:   safeDate(raw.lastRunTime),
    nextRunTime:   safeDate(raw.nextRunTime),
    lastRunStatus: safeStr(raw.lastRunStatus),
    environment:   safeStr(raw.environment),
    ownerTeam:     safeStr(raw.ownerTeam),
    startCommand:  safeStr(raw.startCommand),
    stopCommand:   safeStr(raw.stopCommand),
    statusCommand: safeStr(raw.statusCommand),
    logPath:       safeStr(raw.logPath),
    configPath:    safeStr(raw.configPath),
    notes:         safeStr(raw.notes),
  };

  // Derived field — never trust the client to compute this
  batch.isActive = ACTIVE_STATUSES.includes(batch.lastRunStatus);

  return batch;
}

/**
 * Validates that a batch has the minimum required fields.
 * Returns an array of warning strings (empty array means valid).
 * @param {BatchModel} batch
 * @returns {string[]}
 */
function validateBatch(batch) {
  const warnings = [];
  if (!batch.batchId)   warnings.push(`Missing batchId`);
  if (!batch.batchName) warnings.push(`[${batch.batchId}] Missing batchName`);
  if (!batch.domain)    warnings.push(`[${batch.batchId}] Missing domain`);
  return warnings;
}

module.exports = { createBatch, validateBatch };
