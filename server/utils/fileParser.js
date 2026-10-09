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
const XLSX = require('xlsx');
const { COLUMN_MAP, SHEET_LOG_PATHS } = require('../config/columnMapping.config');

/**
 * Extracts clean string text from any Excel cell value.
 * Handles strings, numbers, booleans, dates, richText arrays, formulas with result,
 * hyperlinks, and error objects safely.
 *
 * @param {any} val
 * @returns {string}
 */
function getCellText(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object') {
    if (Array.isArray(val.richText)) {
      return val.richText.map((r) => r.text || '').join('').trim();
    }
    if (val.result !== undefined && val.result !== null) {
      return getCellText(val.result);
    }
    if (val.text !== undefined && val.text !== null) {
      return String(val.text).trim();
    }
    if (val.hyperlink) {
      return String(val.text || val.hyperlink).trim();
    }
    if (val.error) return '';
  }
  return String(val).trim();
}

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

  // If the header refers to child or parent relationships/references,
  // do not map it to the primary batch model properties.
  if (key.includes('child') || key.includes('parent')) {
    return null;
  }

  // Heuristic substring match
  if (key.includes('batchname') || key.includes('jobname') || key.startsWith('batch') || key.startsWith('job') || key.includes('process') || key.includes('program')) {
    return 'batchName';
  }
  if (key.includes('argument') || key.includes('jvm') || key.includes('args') || key.includes('param') || key.includes('flag') || key.includes('option')) {
    return 'arguments';
  }
  if (key.includes('schedule') || key.includes('jobgroup') || key.includes('sched') || key.includes('cron') || key.includes('frequency') || key.includes('timing') || key.includes('groupname') || key === 'group') {
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
 * Universal fallback parsing using XLSX library (SheetJS).
 * Supports .xls, .xlsx, .xlsm, .xlsb, and other spreadsheet formats.
 *
 * @param {Buffer|string} source - Buffer or file path
 * @param {'benefits'|'tax'|null} [defaultSheetSource=null]
 * @returns {{ rows: Object[], warnings: string[] }}
 */
function parseWithXLSXLibrary(source, defaultSheetSource = null) {
  const warnings = [];
  const allRows = [];

  const readOptions = {
    type: Buffer.isBuffer(source) ? 'buffer' : 'file',
    cellDates: true,
    cellText: false,
    raw: false,
    dense: false,
  };

  const workbook = typeof source === 'string'
    ? XLSX.readFile(source, readOptions)
    : XLSX.read(source, readOptions);

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    return { rows: [], warnings: ['Workbook contains no sheets.'] };
  }

  // When targeting a specific sheet source, search for a sheet matching by name first
  let sheetNamesToProcess = workbook.SheetNames;
  if (defaultSheetSource) {
    const matchingSheet = workbook.SheetNames.find((name) =>
      detectSheetSource(name, null) === defaultSheetSource
    );
    if (matchingSheet) {
      sheetNamesToProcess = [matchingSheet];
    } else {
      // Find the first sheet that has non-empty rows
      const nonEmptySheet = workbook.SheetNames.find((name) => {
        const ws = workbook.Sheets[name];
        if (!ws) return false;
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
        return data && data.length > 0;
      }) || workbook.SheetNames[0];
      sheetNamesToProcess = [nonEmptySheet];
    }
  }

  for (const sheetName of sheetNamesToProcess) {
    const sheetSource = defaultSheetSource || detectSheetSource(sheetName, null);
    if (!sheetSource) {
      warnings.push(`Sheet "${sheetName}" is not a recognised Benefits or Tax sheet — skipped.`);
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Convert sheet to 2D array of raw values
    const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
    if (!sheetData || sheetData.length === 0) {
      warnings.push(`Sheet "${sheetName}" has no data rows — skipped.`);
      continue;
    }

    // Find the header row by checking top 10 rows for matching column names
    let headerRowIndex = 0;
    let bestMatchCount = 0;
    let headerIndex = {};

    const maxHeaderScan = Math.min(10, sheetData.length);
    for (let r = 0; r < maxHeaderScan; r++) {
      const candidateRow = sheetData[r];
      if (!candidateRow || candidateRow.length === 0) continue;

      const currentHeaderIndex = {};
      let matchCount = 0;

      candidateRow.forEach((cellVal, colIdx) => {
        const text = getCellText(cellVal);
        const fieldName = matchHeaderField(text);
        if (fieldName) {
          currentHeaderIndex[colIdx] = fieldName;
          matchCount++;
        }
      });

      if (matchCount > bestMatchCount) {
        bestMatchCount = matchCount;
        headerRowIndex = r;
        headerIndex = currentHeaderIndex;
      }
    }

    // Positional fallback if no batchName header was identified
    const mappedFields = Object.values(headerIndex).filter(Boolean);
    if (!mappedFields.includes('batchName')) {
      const headerRow = sheetData[headerRowIndex] || [];
      headerIndex[0] = 'batchName';
      if (headerRow.length > 1 && !mappedFields.includes('scheduleName')) {
        headerIndex[1] = headerRow.length === 2 ? 'scheduleName' : 'arguments';
      }
      if (headerRow.length > 2 && !mappedFields.includes('scheduleName')) {
        headerIndex[2] = 'scheduleName';
      }
      if (headerRow.length > 3 && !mappedFields.includes('triggerNeeded')) {
        headerIndex[3] = 'triggerNeeded';
      }
    }

    const logDir = SHEET_LOG_PATHS[sheetSource] || '';

    // Data rows start immediately after the header row
    for (let r = headerRowIndex + 1; r < sheetData.length; r++) {
      const row = sheetData[r];
      if (!row || row.length === 0) continue;

      const mapped = { sheetSource, logDir, batchName: '', arguments: '', scheduleName: '', triggerNeeded: '' };
      let hasValue = false;

      row.forEach((cellVal, colIdx) => {
        const fieldName = headerIndex[colIdx];
        if (!fieldName) return;
        const cleanVal = getCellText(cellVal);
        mapped[fieldName] = cleanVal;
        if (cleanVal) hasValue = true;
      });

      if (hasValue && mapped.batchName) {
        allRows.push(mapped);
      }
    }
  }

  return { rows: allRows, warnings };
}

/**
 * Internal: walks sheets in a loaded ExcelJS Workbook and returns rows.
 * Detects matching sheet name or first non-empty sheet when defaultSheetSource is provided.
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

  // When targeting a specific sheet source, search for a sheet matching by name first
  let sheetsToProcess = workbook.worksheets;
  if (defaultSheetSource) {
    const matchingSheet = workbook.worksheets.find((ws) =>
      detectSheetSource(ws.name, null) === defaultSheetSource
    );
    if (matchingSheet) {
      sheetsToProcess = [matchingSheet];
    } else {
      // Find the first sheet that has rows/data
      const nonEmptySheet = workbook.worksheets.find((ws) => ws.rowCount > 1) || workbook.worksheets[0];
      sheetsToProcess = [nonEmptySheet];
    }
  }

  sheetsToProcess.forEach((sheet) => {
    const sheetName = sheet.name;
    const sheetSource = defaultSheetSource || detectSheetSource(sheetName, null);

    if (!sheetSource) {
      warnings.push(`Sheet "${sheetName}" is not a recognised Benefits or Tax sheet — skipped.`);
      return;
    }

    // Find the header row by scanning rows 1 through 10 for matching column names
    let headerRowNumber = 1;
    let bestMatchCount = 0;
    let headerIndex = {};

    const maxHeaderScan = Math.min(10, sheet.rowCount || 10);
    for (let r = 1; r <= maxHeaderScan; r++) {
      const candidateRow = sheet.getRow(r);
      if (!candidateRow || candidateRow.cellCount === 0) continue;

      const currentHeaderIndex = {};
      let matchCount = 0;

      candidateRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
        const text = getCellText(cell.value);
        const fieldName = matchHeaderField(text);
        if (fieldName) {
          currentHeaderIndex[colNum] = fieldName;
          matchCount++;
        }
      });

      if (matchCount > bestMatchCount) {
        bestMatchCount = matchCount;
        headerRowNumber = r;
        headerIndex = currentHeaderIndex;
      }
    }

    // Fallback if no batchName column found among mapped columns
    const mappedFields = Object.values(headerIndex).filter(Boolean);
    if (!mappedFields.includes('batchName')) {
      const colNums = Object.keys(headerIndex).map(Number).sort((a, b) => a - b);
      if (colNums.length > 0) {
        headerIndex[colNums[0]] = 'batchName';
        if (colNums.length > 1 && !mappedFields.includes('scheduleName')) {
          headerIndex[colNums[1]] = colNums.length === 2 ? 'scheduleName' : 'arguments';
        }
        if (colNums.length > 2 && !mappedFields.includes('scheduleName')) {
          headerIndex[colNums[2]] = 'scheduleName';
        }
        if (colNums.length > 3 && !mappedFields.includes('triggerNeeded')) {
          headerIndex[colNums[3]] = 'triggerNeeded';
        }
      } else {
        // No headers identified at all — use default positional columns (1-based for ExcelJS)
        headerIndex[1] = 'batchName';
        headerIndex[2] = 'arguments';
        headerIndex[3] = 'scheduleName';
        headerIndex[4] = 'triggerNeeded';
      }
    }

    const logDir = SHEET_LOG_PATHS[sheetSource] || '';

    // ── Parse data rows (rows after the header row) ──────────────────────
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return; // skip header and any rows above header

      const mapped   = { sheetSource, logDir };
      let   hasValue = false;

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const fieldName = headerIndex[colNum];
        if (!fieldName) return;

        const cleanVal = getCellText(cell.value);
        mapped[fieldName] = cleanVal;
        if (cleanVal) hasValue = true;
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
  // Infer defaultSheetSource from file path if not passed
  if (!defaultSheetSource && typeof filePath === 'string') {
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.includes('benefit')) defaultSheetSource = 'benefits';
    else if (lowerPath.includes('tax')) defaultSheetSource = 'tax';
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    return _extractRowsFromWorkbook(workbook, defaultSheetSource);
  } catch (excelJsErr) {
    console.warn(`[fileParser] ExcelJS failed to read ${filePath} (${excelJsErr.message}), falling back to universal XLSX parser...`);
    try {
      return parseWithXLSXLibrary(filePath, defaultSheetSource);
    } catch (xlsxLibErr) {
      console.error(`[fileParser] Universal XLSX parser also failed for ${filePath}: ${xlsxLibErr.message}`);
      throw excelJsErr;
    }
  }
}

/**
 * Reads an Excel (.xlsx, .xls, .xlsm, .xlsb) or CSV file from an in-memory Buffer
 * and returns an array of raw row objects.
 *
 * @param {Buffer} buffer - raw spreadsheet file bytes
 * @param {'benefits'|'tax'} [defaultSheetSource=null]
 * @returns {Promise<{ rows: Object[], warnings: string[] }>}
 */
async function parseExcelBuffer(buffer, defaultSheetSource = null) {
  // Check if buffer is a zip-based Office Open XML format (.xlsx, .xlsm, .xlsb)
  // ZIP files always start with magic bytes PK\x03\x04 (0x50, 0x4b, 0x03, 0x04)
  const isZip = buffer && buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;

  if (isZip) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      return _extractRowsFromWorkbook(workbook, defaultSheetSource);
    } catch (excelJsErr) {
      // If ExcelJS failed on valid zip, fallback to universal XLSX parser
      try {
        return parseWithXLSXLibrary(buffer, defaultSheetSource);
      } catch (xlsxLibErr) {
        throw excelJsErr;
      }
    }
  }

  // 2. For binary Excel (.xls BIFF), try universal SheetJS parser first
  try {
    const xlsxResult = parseWithXLSXLibrary(buffer, defaultSheetSource);
    if (xlsxResult.rows.length > 0) {
      return xlsxResult;
    }
  } catch (xlsxLibErr) {
    // Fall through to CSV
  }

  // 3. Check if plain text / CSV format
  try {
    const csvResult = parseCsvBuffer(buffer, defaultSheetSource);
    if (csvResult.rows.length > 0) {
      return csvResult;
    }
  } catch (csvErr) {
    // Fall through
  }

  // 4. Final attempt with XLSX library
  return parseWithXLSXLibrary(buffer, defaultSheetSource);
}

module.exports = { parseExcelFile, parseExcelBuffer };
