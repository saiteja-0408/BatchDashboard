/**
 * fileParser.js — pure utility functions for parsing Excel workbooks using ExcelJS.
 *
 * Kept dependency-free from the rest of the app so it can be unit-tested
 * in isolation. Receives a file path, returns raw row objects synchronously.
 */

const ExcelJS = require('exceljs');
const columnMap = require('../config/columnMapping.config');

/**
 * Reads an Excel file and returns an array of raw row objects keyed by
 * internal field names (after applying the column mapping).
 *
 * All sheets are processed; rows from all sheets are merged into a single array.
 *
 * NOTE: ExcelJS workbook.xlsx.readFile is async — this function returns a Promise.
 *
 * @param {string} filePath - Absolute path to the .xlsx file
 * @returns {Promise<{ rows: Object[], warnings: string[] }>}
 */
async function parseExcelFile(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const warnings = [];
  const allRows = [];

  workbook.eachSheet((sheet, _sheetId) => {
    const sheetName = sheet.name;

    // Row 1 is the header row
    const headerRow = sheet.getRow(1);
    if (!headerRow || headerRow.cellCount === 0) {
      warnings.push(`Sheet "${sheetName}" has no header row — skipped.`);
      return;
    }

    // Build header index: column number → Excel column header string
    const headerIndex = {};
    headerRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
      headerIndex[colNum] = String(cell.value || '').trim();
    });

    const presentHeaders = new Set(Object.values(headerIndex));

    // Warn about expected columns that are absent
    for (const excelHeader of Object.keys(columnMap)) {
      if (!presentHeaders.has(excelHeader)) {
        warnings.push(`Sheet "${sheetName}": expected column "${excelHeader}" not found.`);
      }
    }

    // Invert columnMap for fast lookup: Excel header → internal field name
    const excelToField = columnMap; // { ExcelHeader: fieldName }

    // Process data rows (row 2 onwards)
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const mapped = {};
      let hasValue = false;

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const excelHeader = headerIndex[colNum];
        const fieldName = excelHeader ? excelToField[excelHeader] : null;
        if (!fieldName) return;

        let val = cell.value;
        // ExcelJS returns rich text objects for some cells
        if (val && typeof val === 'object' && val.richText) {
          val = val.richText.map((r) => r.text).join('');
        }
        // ExcelJS returns Date objects for date-formatted cells
        if (val instanceof Date) {
          val = val.toISOString();
        }
        mapped[fieldName] = val !== null && val !== undefined ? String(val).trim() : '';
        if (mapped[fieldName]) hasValue = true;
      });

      // Fill in any missing mapped fields with empty string
      for (const fieldName of Object.values(excelToField)) {
        if (!(fieldName in mapped)) mapped[fieldName] = '';
      }

      if (hasValue) allRows.push(mapped);
    });
  });

  return { rows: allRows, warnings };
}

module.exports = { parseExcelFile };
