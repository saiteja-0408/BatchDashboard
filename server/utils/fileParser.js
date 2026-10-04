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

function cleanHeaderKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Build a lookup map: normalised Excel header → internal field name.
 * Computed once at module load time.
 */
const NORMALISED_COLUMN_MAP = Object.fromEntries(
  Object.entries(COLUMN_MAP).map(([header, field]) => [normaliseHeader(header), field])
);

/**
 * Fallback fuzzy header mapper if exact normalized match fails.
 * Matches common patterns (e.g. "batch", "job", "arg", "sched", "group", "trigger").
 * @param {string} rawHeader
 * @returns {string|null}
 */
function matchHeaderField(rawHeader) {
  if (!rawHeader) return null;
  const norm = normaliseHeader(rawHeader);
  if (NORMALISED_COLUMN_MAP[norm]) return NORMALISED_COLUMN_MAP[norm];

  const key = cleanHeaderKey(rawHeader);
  if (!key) return null;

  // Direct match on alphanumeric-only keys
  for (const [header, field] of Object.entries(COLUMN_MAP)) {
    if (cleanHeaderKey(header) === key) {
      return field;
    }
  }

  // Heuristic substring match
  if (key.includes('batchname') || key.includes('jobname') || key.startsWith('batch') || key.startsWith('job')) {
    return 'batchName';
  }
  if (key.includes('argument') || key.includes('jvm') || key.includes('args')) {
    return 'arguments';
  }
  if (key.includes('schedule') || key.includes('jobgroup') || key.includes('sched')) {
    return 'scheduleName';
  }
  if (key.includes('trigger')) {
    return 'triggerNeeded';
  }

  return null;
}

/**
 * Determine the sheetSource tag from the sheet name.
 * Returns 'benefits', 'tax', or null (unrecognised → skip).
 * @param {string} sheetName
 * @param {'benefits'|'tax'|null} [defaultSheetSource=null]
 * @returns {'benefits'|'tax'|null}
 */
function detectSheetSource(sheetName, defaultSheetSource = null) {
  if (defaultSheetSource) return defaultSheetSource;
  const lower = (sheetName || '').toLowerCase().trim();
  if (lower.includes('benefit')) return 'benefits';
  if (lower.includes('tax'))     return 'tax';
  return null;
}

/**
 * Internal: walks sheets in a loaded ExcelJS Workbook and returns rows.
 * When defaultSheetSource is specified (e.g. Benefits or Tax file/upload), always reads
 * the first sheet (index 0) of the workbook regardless of its name.
 * If defaultSheetSource is not provided, processes all sheets and identifies Benefits/Tax by name.
 *
 * Shared by both parseExcelFile and parseExcelBuffer.
 *
 * @param {ExcelJS.Workbook} workbook
 * @param {'benefits'|'tax'|null} [defaultSheetSource=null]
 * @returns {{ rows: Object[], warnings: string[] }}
 */
function _extractRowsFromWorkbook(workbook, defaultSheetSource = null) {
  const warnings = [];
  const allRows  = [];

  if (!workbook.worksheets || workbook.worksheets.length === 0) {
    return { rows: [], warnings: ['Workbook contains no sheets.'] };
  }

  // When targeting a specific sheet source (Benefits or Tax file read / upload),
  // always process the FIRST sheet (index 0) regardless of the sheet's name.
  const sheetsToProcess = defaultSheetSource
    ? [workbook.worksheets[0]]
    : workbook.worksheets;

  sheetsToProcess.forEach((sheet) => {
    const sheetName = sheet.name;
    const sheetSource = defaultSheetSource || detectSheetSource(sheetName, null);

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
      const raw = cell.value;
      const rawText = raw && typeof raw === 'object' && raw.richText
        ? raw.richText.map((r) => r.text).join('')
        : String(raw || '');
      const fieldName = matchHeaderField(rawText);
      headerIndex[colNum] = fieldName;
    });

    // Fallback if header row didn't map batchName by name (e.g. headerless or unexpected custom titles):
    // If no batchName column found among mapped columns, default Column 1 -> batchName, Column 2 -> arguments/schedule, etc.
    const mappedFields = Object.values(headerIndex).filter(Boolean);
    if (!mappedFields.includes('batchName')) {
      const colNums = Object.keys(headerIndex).map(Number).sort((a, b) => a - b);
      if (colNums.length > 0) {
        headerIndex[colNums[0]] = 'batchName';
      }
      if (colNums.length > 1 && !mappedFields.includes('scheduleName')) {
        headerIndex[colNums[1]] = colNums.length === 2 ? 'scheduleName' : 'arguments';
      }
      if (colNums.length > 2 && !mappedFields.includes('scheduleName')) {
        headerIndex[colNums[2]] = 'scheduleName';
      }
      if (colNums.length > 3 && !mappedFields.includes('triggerNeeded')) {
        headerIndex[colNums[3]] = 'triggerNeeded';
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

      // Fill default absent fields
      ['batchName', 'arguments', 'scheduleName', 'triggerNeeded'].forEach((fieldName) => {
        if (!(fieldName in mapped)) mapped[fieldName] = '';
      });

      // Only store rows that have at least a batchName value
      if (hasValue && mapped.batchName) allRows.push(mapped);
    });
  });

  return { rows: allRows, warnings };
}

/**
 * Parses a simple CSV buffer into row objects using line and comma split.
 * Handles quoted cells with embedded commas and whitespace.
 * @param {Buffer} buffer
 * @param {'benefits'|'tax'} [defaultSheetSource='benefits']
 * @returns {{ rows: Object[], warnings: string[] }}
 */
function parseCsvBuffer(buffer, defaultSheetSource = 'benefits') {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], warnings: ['CSV file is empty or missing data rows.'] };
  }

  // Parse CSV line respecting quotes
  const parseLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headerCells = parseLine(lines[0]);
  const colIndexToField = {};
  headerCells.forEach((header, idx) => {
    const raw = header.replace(/^["']|["']$/g, '');
    const field = matchHeaderField(raw);
    if (field) {
      colIndexToField[idx] = field;
    }
  });

  if (!Object.values(colIndexToField).includes('batchName') && headerCells.length > 0) {
    colIndexToField[0] = 'batchName';
    if (headerCells.length > 1) colIndexToField[1] = headerCells.length === 2 ? 'scheduleName' : 'arguments';
    if (headerCells.length > 2) colIndexToField[2] = 'scheduleName';
    if (headerCells.length > 3) colIndexToField[3] = 'triggerNeeded';
  }

  const sheetSource = defaultSheetSource || 'benefits';
  const logDir = SHEET_LOG_PATHS[sheetSource] || '';
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const mapped = { sheetSource, logDir, batchName: '', arguments: '', scheduleName: '', triggerNeeded: '' };
    let hasValue = false;

    cells.forEach((val, colIdx) => {
      const field = colIndexToField[colIdx];
      if (field) {
        const clean = val.replace(/^["']|["']$/g, '').trim();
        mapped[field] = clean;
        if (clean) hasValue = true;
      }
    });

    if (hasValue && mapped.batchName) {
      rows.push(mapped);
    }
  }

  return { rows, warnings: [] };
}

/**
 * Reads an Excel file from disk and returns an array of raw row objects.
 * Each row carries three mapped fields plus sheetSource and logDir.
 *
 * @param {string} filePath - Absolute path to the .xlsx file
 * @param {'benefits'|'tax'|null} [defaultSheetSource=null]
 * @returns {Promise<{ rows: Object[], warnings: string[] }>}
 */
async function parseExcelFile(filePath, defaultSheetSource = null) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // If defaultSheetSource was not explicitly passed, infer it from the file name
  if (!defaultSheetSource && typeof filePath === 'string') {
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.includes('benefit')) defaultSheetSource = 'benefits';
    else if (lowerPath.includes('tax')) defaultSheetSource = 'tax';
  }

  return _extractRowsFromWorkbook(workbook, defaultSheetSource);
}

/**
 * Reads an Excel or CSV file from an in-memory Buffer and returns an array of raw
 * row objects. Used by the upload endpoint so no temp file is needed.
 *
 * @param {Buffer} buffer - raw .xlsx/.xls/.csv file bytes
 * @param {'benefits'|'tax'} [defaultSheetSource=null]
 * @returns {Promise<{ rows: Object[], warnings: string[] }>}
 */
async function parseExcelBuffer(buffer, defaultSheetSource = null) {
  // Check if buffer is CSV by checking first bytes / attempting exceljs load
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return _extractRowsFromWorkbook(workbook, defaultSheetSource);
  } catch (xlsxErr) {
    // If ExcelJS failed, attempt CSV parsing
    try {
      const csvResult = parseCsvBuffer(buffer, defaultSheetSource);
      if (csvResult.rows.length > 0) {
        return csvResult;
      }
    } catch {
      // Fall through to throw original error
    }
    throw xlsxErr;
  }
}

module.exports = { parseExcelFile, parseExcelBuffer };
