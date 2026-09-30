/**
 * fileParser.js — parses the two-sheet batch Excel workbook using ExcelJS.
 *
 * Sheet detection:
 *   - Any sheet whose name contains "benefit" (case-insensitive) → sheetSource: 'benefits'
 *   - Any sheet whose name contains "tax"     (case-insensitive) → sheetSource: 'tax'
 *   - Other sheets are skipped with a warning.
 *
 * Each sheet is expected to have exactly these three column headers
 * (whitespace-normalised before matching):
 *   "Batch Name/Job Name"
 *   "Batch Arguments/JVM Arguments"
 *   "Schedule Name/ Job Group Name"
 *
 * Header matching is whitespace-normalised (collapse internal spaces, trim) to
 * tolerate minor formatting differences in the actual Excel file.
 */

const ExcelJS = require('exceljs');
const { COLUMN_MAP, SHEET_LOG_PATHS } = require('../config/columnMapping.config');

/**
 * Normalise a header string for matching:
 *   - trim leading/trailing whitespace
 *   - collapse multiple internal spaces / newlines to a single space
 * @param {string} s
 * @returns {string}
 */
function normaliseHeader(s) {
  return String(s || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Build a lookup map: normalised Excel header → internal field name.
 * Computed once at module load time.
 */
const NORMALISED_COLUMN_MAP = Object.fromEntries(
  Object.entries(COLUMN_MAP).map(([header, field]) => [normaliseHeader(header), field])
);

/**
 * Determine the sheetSource tag from the sheet name.
 * Returns 'benefits', 'tax', or null (unrecognised → skip).
 * @param {string} sheetName
 * @returns {'benefits'|'tax'|null}
 */
function detectSheetSource(sheetName) {
  const lower = sheetName.toLowerCase();
  if (lower.includes('benefit')) return 'benefits';
  if (lower.includes('tax'))     return 'tax';
  return null;
}

/**
 * Reads an Excel file and returns an array of raw row objects.
 * Each row carries three mapped fields plus sheetSource and logDir.
 *
 * @param {string} filePath - Absolute path to the .xlsx file
 * @returns {Promise<{ rows: Object[], warnings: string[] }>}
 */
async function parseExcelFile(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const warnings = [];
  const allRows  = [];

  workbook.eachSheet((sheet) => {
    const sheetName   = sheet.name;
    const sheetSource = detectSheetSource(sheetName);

    if (!sheetSource) {
      warnings.push(`Sheet "${sheetName}" is not a recognised Benefits or Tax sheet — skipped.`);
      return;
    }

    // ── Parse header row (row 1) ──────────────────────────────────────────
    const headerRow = sheet.getRow(1);
    if (!headerRow || headerRow.cellCount === 0) {
      warnings.push(`Sheet "${sheetName}" has no header row — skipped.`);
      return;
    }

    // headerIndex: column number → internal field name (null if not mapped)
    const headerIndex = {};
    headerRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
      const raw        = cell.value;
      const normHeader = normaliseHeader(
        raw && typeof raw === 'object' && raw.richText
          ? raw.richText.map((r) => r.text).join('')
          : String(raw || '')
      );
      const fieldName = NORMALISED_COLUMN_MAP[normHeader] || null;
      headerIndex[colNum] = fieldName;
    });

    // Warn about any expected column that is entirely absent from this sheet
    const presentFields = new Set(Object.values(headerIndex).filter(Boolean));
    for (const fieldName of Object.values(COLUMN_MAP)) {
      if (!presentFields.has(fieldName)) {
        // Find the expected Excel header name for a readable warning
        const excelHeader = Object.keys(COLUMN_MAP).find((k) => COLUMN_MAP[k] === fieldName);
        warnings.push(`Sheet "${sheetName}": expected column "${excelHeader}" not found.`);
      }
    }

    const logDir = SHEET_LOG_PATHS[sheetSource] || '';

    // ── Parse data rows (row 2 onwards) ──────────────────────────────────
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const mapped   = { sheetSource, logDir };
      let   hasValue = false;

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const fieldName = headerIndex[colNum];
        if (!fieldName) return;

        let val = cell.value;
        // Unwrap ExcelJS rich-text objects
        if (val && typeof val === 'object' && val.richText) {
          val = val.richText.map((r) => r.text).join('');
        }
        // Unwrap date objects
        if (val instanceof Date) val = val.toISOString();

        mapped[fieldName] = val !== null && val !== undefined ? String(val).trim() : '';
        if (mapped[fieldName]) hasValue = true;
      });

      // Fill any absent mapped fields with empty string
      for (const fieldName of Object.values(COLUMN_MAP)) {
        if (!(fieldName in mapped)) mapped[fieldName] = '';
      }

      // Only store rows that have at least a batchName value
      if (hasValue && mapped.batchName) allRows.push(mapped);
    });
  });

  return { rows: allRows, warnings };
}

module.exports = { parseExcelFile };
