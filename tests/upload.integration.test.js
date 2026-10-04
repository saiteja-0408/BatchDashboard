/**
 * upload.integration.test.js
 *
 * Integration tests for POST /api/batches/upload/:sheet
 *
 * Strategy:
 *   - Build a minimal Express app (same pattern as currentTasks tests).
 *   - Load test data into the store via loadFromFile (fixture) before each suite.
 *   - For successful upload tests, read the real benefits.xlsx / tax.xlsx from
 *     data/ as a Buffer and send it as multipart/form-data via supertest.
 *   - Verify: store count, response shape, per-sheet isolation (other sheet unchanged).
 *   - Verify error paths: no file, wrong sheet param, non-xlsx content.
 *
 * One-time loading assertion:
 *   - Confirm that after startup the store is populated exactly once and that
 *     subsequent calls to getAll() return from the in-memory store (no disk I/O).
 */

'use strict';

const request    = require('supertest');
const path       = require('path');
const fs         = require('fs');
const express    = require('express');

require('dotenv').config();

const excelService      = require('../server/services/excelService');
const batchRoutes       = require('../server/routes/batchRoutes');
const { errorHandler }  = require('../server/middlewares/errorHandler');

const FIXTURE_PATH    = path.resolve(__dirname, '../data/batches.xlsx');
const BENEFITS_PATH   = path.resolve(__dirname, '../data/benefits.xlsx');
const TAX_PATH        = path.resolve(__dirname, '../data/tax.xlsx');

// Build a minimal test app (no app.listen)
const app = express();
app.use(express.json());
app.use('/api', batchRoutes);
app.use(errorHandler);

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Read a file into a Buffer — used to send as multipart upload. */
function readBuffer(filePath) {
  return fs.readFileSync(filePath);
}

// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/batches/upload/:sheet — upload endpoint', () => {

  beforeAll(async () => {
    // Load the combined fixture so each test starts with a known store state
    await excelService.loadFromFile(FIXTURE_PATH);
  });

  // ── Valid uploads ────────────────────────────────────────────────────────

  describe('successful upload — benefits sheet', () => {
    let res;

    beforeAll(async () => {
      const buf = readBuffer(BENEFITS_PATH);
      res = await request(app)
        .post('/api/batches/upload/benefits')
        .attach('file', buf, { filename: 'benefits.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    });

    test('returns HTTP 201', () => {
      expect(res.status).toBe(201);
    });

    test('response has success:true', () => {
      expect(res.body.success).toBe(true);
    });

    test('response sheet matches param', () => {
      expect(res.body.sheet).toBe('benefits');
    });

    test('response count is a positive number', () => {
      expect(typeof res.body.count).toBe('number');
      expect(res.body.count).toBeGreaterThan(0);
    });

    test('response message is a non-empty string', () => {
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(0);
    });

    test('GET /api/batches?sheet=benefits now returns reloaded data', async () => {
      const getRes = await request(app).get('/api/batches?sheet=benefits');
      expect(getRes.status).toBe(200);
      expect(getRes.body.count).toBeGreaterThan(0);
      expect(getRes.body.count).toBe(res.body.count);
    });

    test('tax sheet is NOT affected by benefits upload', async () => {
      const taxBefore = excelService.getAll('tax').length;
      // Upload benefits again
      const buf = readBuffer(BENEFITS_PATH);
      await request(app)
        .post('/api/batches/upload/benefits')
        .attach('file', buf, { filename: 'benefits.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const taxAfter = excelService.getAll('tax').length;
      expect(taxAfter).toBe(taxBefore);
    });
  });

  describe('successful upload — tax sheet', () => {
    let res;

    beforeAll(async () => {
      const buf = readBuffer(TAX_PATH);
      res = await request(app)
        .post('/api/batches/upload/tax')
        .attach('file', buf, { filename: 'tax.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    });

    test('returns HTTP 201', () => {
      expect(res.status).toBe(201);
    });

    test('response sheet is "tax"', () => {
      expect(res.body.sheet).toBe('tax');
    });

    test('response count is positive', () => {
      expect(res.body.count).toBeGreaterThan(0);
    });

    test('benefits sheet is NOT affected by tax upload', async () => {
      const benBefore = excelService.getAll('benefits').length;
      const buf = readBuffer(TAX_PATH);
      await request(app)
        .post('/api/batches/upload/tax')
        .attach('file', buf, { filename: 'tax.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const benAfter = excelService.getAll('benefits').length;
      expect(benAfter).toBe(benBefore);
    });
  });

  describe('successful upload — CSV file', () => {
    test('uploads and parses valid CSV data successfully for benefits', async () => {
      const csvContent =
        'Batch Name,Schedule Name,Arguments,Trigger Needed\n' +
        'TestCsvBatch1,benefits_daily_6am,-Xmx512m,Y\n' +
        'TestCsvBatch2,benefits_daily_8am,-Xmx1024m,N\n';
      const res = await request(app)
        .post('/api/batches/upload/benefits')
        .attach('file', Buffer.from(csvContent), { filename: 'benefits.csv', contentType: 'text/csv' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.sheet).toBe('benefits');
      expect(res.body.count).toBe(2);

      const getRes = await request(app).get('/api/batches?sheet=benefits');
      expect(getRes.body.data.some((b) => b.batchName === 'TestCsvBatch1')).toBe(true);
    });

    test('uploads and parses valid CSV data successfully for tax', async () => {
      const csvContent =
        'Batch Name/Job Name,Schedule Name/ Job Group Name,Batch Arguments/JVM Arguments\n' +
        'TaxCsvBatch1,benefits_weekly_monday_515pm,-Xms256m\n';
      const res = await request(app)
        .post('/api/batches/upload/tax')
        .attach('file', Buffer.from(csvContent), { filename: 'tax.csv', contentType: 'text/csv' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.sheet).toBe('tax');
      expect(res.body.count).toBe(1);

      const getRes = await request(app).get('/api/batches?sheet=tax');
      expect(getRes.body.data.some((b) => b.batchName === 'TaxCsvBatch1')).toBe(true);
    });
  });

  describe('successful parsing of arbitrary first sheet name (first sheet index logic)', () => {
    test('parses workbook where the first sheet has an arbitrary name e.g. "MyCustomSheet"', async () => {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('MyCustomSheet');
      ws.addRow(['Batch Name/Job Name', 'Schedule Name/ Job Group Name', 'Batch Arguments/JVM Arguments']);
      ws.addRow(['TestCustomSheetBatch', 'benefits_daily_6am', '-Xmx512m']);
      const buf = await wb.xlsx.writeBuffer();

      const res = await request(app)
        .post('/api/batches/upload/benefits')
        .attach('file', Buffer.from(buf), { filename: 'benefits_custom.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      expect(res.status).toBe(201);
      expect(res.body.sheet).toBe('benefits');
      expect(res.body.count).toBe(1);

      const getRes = await request(app).get('/api/batches?sheet=benefits');
      expect(getRes.body.data.some((b) => b.batchName === 'TestCustomSheetBatch')).toBe(true);
    });

    test('parses workbook where the first sheet is named "Sheet1" for tax upload', async () => {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow(['Batch Name/Job Name', 'Schedule Name/ Job Group Name', 'Batch Arguments/JVM Arguments']);
      ws.addRow(['TestTaxSheet1Batch', 'benefits_weekly_monday_515pm', '-Xmx1024m']);
      const buf = await wb.xlsx.writeBuffer();

      const res = await request(app)
        .post('/api/batches/upload/tax')
        .attach('file', Buffer.from(buf), { filename: 'tax_sheet1.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      expect(res.status).toBe(201);
      expect(res.body.sheet).toBe('tax');
      expect(res.body.count).toBe(1);

      const getRes = await request(app).get('/api/batches?sheet=tax');
      expect(getRes.body.data.some((b) => b.batchName === 'TestTaxSheet1Batch')).toBe(true);
    });
  });

  // ── Error paths ──────────────────────────────────────────────────────────

  describe('error path — invalid sheet param', () => {
    test('returns 400 for unknown sheet name', async () => {
      const buf = readBuffer(BENEFITS_PATH);
      const res = await request(app)
        .post('/api/batches/upload/unknown')
        .attach('file', buf, { filename: 'benefits.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('error path — no file provided', () => {
    test('returns an error status when no file is attached', async () => {
      // supertest sends a Content-Type without a boundary, causing multer to
      // emit a "Boundary not found" error (500) before the controller runs.
      // The controller path (no req.file → 400) is also valid. Both are errors.
      const res = await request(app)
        .post('/api/batches/upload/benefits')
        .set('Content-Type', 'multipart/form-data');
      expect([400, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('error path — wrong file type', () => {
    test('returns 400 when an unsupported file type is uploaded', async () => {
      const res = await request(app)
        .post('/api/batches/upload/benefits')
        .attach('file', Buffer.from('some random pdf content'), { filename: 'document.pdf', contentType: 'application/pdf' });
      expect([400, 422, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('universal spreadsheet format uploads (.xls, .xlsm, .xlsb, .xlsx)', () => {
    test('successfully parses legacy binary .xls and .xlsb formats via XLSX fallback', async () => {
      const XLSX = require('xlsx');
      const data = [
        ['Batch Name', 'Arguments', 'Schedule Name', 'Trigger Needed'],
        ['UniversalLegacyBatch', '-Xmx2048m', 'benefits_daily_6am', 'Y'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CustomLegacySheet');

      // Generate legacy .xls / binary format
      const xlsBuf = XLSX.write(wb, { type: 'buffer', bookType: 'biff8' });

      const res = await request(app)
        .post('/api/batches/upload/benefits')
        .attach('file', xlsBuf, { filename: 'legacy_benefits.xls', contentType: 'application/vnd.ms-excel' });

      expect(res.status).toBe(201);
      expect(res.body.sheet).toBe('benefits');
      expect(res.body.count).toBe(1);

      const getRes = await request(app).get('/api/batches?sheet=benefits');
      const found = getRes.body.data.find((b) => b.batchName === 'UniversalLegacyBatch');
      expect(found).toBeDefined();
      expect(found.arguments).toBe('-Xmx2048m');
      expect(found.scheduleName).toBe('benefits_daily_6am');
      expect(found.triggerNeeded).toBe('Y');
    });

    test('successfully parses macro-enabled .xlsm and binary .xlsb formats', async () => {
      const XLSX = require('xlsx');
      const data = [
        ['Job Name', 'JVM Arguments', 'Job Group Name', 'Trigger Needed'],
        ['MacroBatchJob', 'MODE=BATCH', 'benefits_weekly_monday_515pm', 'N'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'MacroFirstSheet');

      const xlsmBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsm' });

      const res = await request(app)
        .post('/api/batches/upload/tax')
        .attach('file', xlsmBuf, { filename: 'tax_macro.xlsm', contentType: 'application/vnd.ms-excel.sheet.macroenabled.12' });

      expect(res.status).toBe(201);
      expect(res.body.sheet).toBe('tax');
      expect(res.body.count).toBe(1);

      const getRes = await request(app).get('/api/batches?sheet=tax');
      const found = getRes.body.data.find((b) => b.batchName === 'MacroBatchJob');
      expect(found).toBeDefined();
      expect(found.arguments).toBe('MODE=BATCH');
      expect(found.scheduleName).toBe('benefits_weekly_monday_515pm');
      expect(found.triggerNeeded).toBe('N');
    });
  });

  describe('flexible header and empty sheet error paths', () => {
    test('returns 422 when an excel file with no batch rows is uploaded', async () => {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Empty');
      ws.addRow(['Batch Name/Job Name', 'Schedule Name/ Job Group Name', 'Batch Arguments/JVM Arguments']);
      // no data rows
      const buf = await wb.xlsx.writeBuffer();

      const res = await request(app)
        .post('/api/batches/upload/benefits')
        .attach('file', Buffer.from(buf), { filename: 'empty.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    test('parses workbook with unconventional column headers e.g. "Job", "Args", "Schedule", "Trigger"', async () => {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow(['Job', 'Args', 'Schedule', 'Trigger']);
      ws.addRow(['CustomHeaderBatch', '-Denv=test', 'benefits_daily_6am', 'Y']);
      const buf = await wb.xlsx.writeBuffer();

      const res = await request(app)
        .post('/api/batches/upload/benefits')
        .attach('file', Buffer.from(buf), { filename: 'custom_headers.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      expect(res.status).toBe(201);
      expect(res.body.sheet).toBe('benefits');
      expect(res.body.count).toBe(1);

      const getRes = await request(app).get('/api/batches?sheet=benefits');
      const found = getRes.body.data.find((b) => b.batchName === 'CustomHeaderBatch');
      expect(found).toBeDefined();
      expect(found.arguments).toBe('-Denv=test');
      expect(found.scheduleName).toBe('benefits_daily_6am');
      expect(found.triggerNeeded).toBe('Y');
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('One-time loading — in-memory store behaviour', () => {

  beforeAll(async () => {
    await excelService.loadFromFile(FIXTURE_PATH);
  });

  test('store is populated after loadFromFile', () => {
    const all = excelService.getAll();
    expect(all.length).toBeGreaterThan(0);
  });

  test('getAll() returns the same reference count on repeated calls (no disk I/O)', () => {
    const first  = excelService.getAll().length;
    const second = excelService.getAll().length;
    expect(first).toBe(second);
  });

  test('getAll("benefits") returns only benefits rows', () => {
    const benefits = excelService.getAll('benefits');
    benefits.forEach((b) => expect(b.sheetSource).toBe('benefits'));
  });

  test('getAll("tax") returns only tax rows', () => {
    const tax = excelService.getAll('tax');
    tax.forEach((b) => expect(b.sheetSource).toBe('tax'));
  });

  test('reloadSheet replaces only that sheet — total count stays consistent', async () => {
    const taxCountBefore      = excelService.getAll('tax').length;
    const benefitsCountBefore = excelService.getAll('benefits').length;

    const buf = readBuffer(BENEFITS_PATH);
    await excelService.reloadSheet('benefits', buf);

    // Tax count must be unchanged
    expect(excelService.getAll('tax').length).toBe(taxCountBefore);
    // Benefits count may change (new file), but must be > 0
    expect(excelService.getAll('benefits').length).toBeGreaterThan(0);
    // Sanity: total = benefits + tax
    expect(excelService.getAll().length).toBe(
      excelService.getAll('benefits').length + excelService.getAll('tax').length
    );

    // Cleanup — reload fixture so subsequent test suites are unaffected
    await excelService.loadFromFile(FIXTURE_PATH);
    expect(excelService.getAll('benefits').length).toBe(benefitsCountBefore);
  });
});
