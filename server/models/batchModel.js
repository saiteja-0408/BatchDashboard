/**
 * batchModel.js — defines the canonical batch data shape and validation helpers.
 *
 * Excel columns per row:
 *   batchName      — from "Batch Name/Job Name"
 *   arguments      — from "Batch Arguments/JVM Arguments" (may be empty)
 *   scheduleName   — from "Schedule Name/ Job Group Name"
 *   triggerNeeded  — from "Trigger Needed"; normalised to 'Y' | 'N' | ''
 *
 * Plus two fields derived by the parser:
 *   sheetSource   — 'benefits' | 'tax'
 *   logDir        — the cd command for that sheet's log directory
 */

/**
 * @typedef {Object} BatchModel
 * @property {string}  batchName      - Batch / job name (primary key — must be unique per sheet)
 * @property {string}  arguments      - JVM / batch arguments; empty string if none
 * @property {string}  scheduleName   - Schedule Name / Job Group Name from Excel
 * @property {string}  triggerNeeded  - 'Y' | 'N' | '' — whether a trigger is needed
 * @property {string}  sheetSource    - 'benefits' | 'tax'
 * @property {string}  logDir         - cd command for the log directory
 */

/**
 * Normalises a raw parsed row object into a well-typed BatchModel.
 *
 * @param {Object} raw  - Object with internal field names (after column mapping)
 * @returns {BatchModel}
 */
function createBatch(raw) {
  const safeStr = (v) => (v === undefined || v === null ? '' : String(v).trim());

  /**
   * Normalise Trigger Needed to uppercase 'Y' or 'N'.
   * Accepts: 'Y'/'y'/'yes'/'true'/true → 'Y'
   *          'N'/'n'/'no'/'false'/false → 'N'
   *          anything else (including empty) → ''
   */
  const normTrigger = (v) => {
    if (v === undefined || v === null || v === '') return '';
    const s = String(v).trim().toLowerCase();
    if (s === 'y' || s === 'yes' || s === 'true') return 'Y';
    if (s === 'n' || s === 'no'  || s === 'false') return 'N';
    return '';
  };

  const batch = {
    batchName:     safeStr(raw.batchName),
    arguments:     safeStr(raw.arguments),
    scheduleName:  safeStr(raw.scheduleName),
    triggerNeeded: normTrigger(raw.triggerNeeded),
    sheetSource:   safeStr(raw.sheetSource),   // set by parser
    logDir:        safeStr(raw.logDir),         // set by parser
  };

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
  if (!batch.batchName)    warnings.push(`Row missing batchName — skipped.`);
  if (!batch.scheduleName) warnings.push(`[${batch.batchName}] Missing scheduleName.`);
  return warnings;
}

module.exports = { createBatch, validateBatch };
