/**
 * currentTasks.integration.test.js
 *
 * Integration tests for GET /api/current-tasks.
 *
 * Strategy:
 *   1. Load the test Excel fixture (data/batches.xlsx) into the store.
 *   2. Mount the Express app and make real HTTP requests via supertest.
 *   3. Mock Date.now / new Date() to a fixed timestamp to make status
 *      assertions deterministic — avoids test flakiness due to real time.
 *
 * Fixed "now": Wednesday 2024-05-15 09:00:00 local time
 *   - benefits_daily_6am  → fires at 06:00, already past → nextRun = tomorrow → idle
 *   - benefits_daily_930am → fires at 09:30, 30 min ahead → upcoming
 */

'use strict';

const request     = require('supertest');
const path        = require('path');

// ── Build a minimal Express app (reuse real route/controller/service) ────────
// We import the service directly so we can load test data without starting
// the full server (no app.listen needed with supertest).
require('dotenv').config();

// Load test data into the store before running tests
const excelService  = require('../server/services/excelService');
const FIXTURE_PATH  = path.resolve(__dirname, '../data/batches.xlsx');

// Build the app after dotenv so env vars are available
const express = require('express');
const batchRoutes = require('../server/routes/batchRoutes');
const { errorHandler } = require('../server/middlewares/errorHandler');

const app = express();
app.use(express.json());
app.use('/api', batchRoutes);
app.use(errorHandler);

// ── Fixed timestamp for all tests ────────────────────────────────────────────
const FIXED_NOW = new Date(2024, 4, 15, 9, 0, 0, 0); // Wed 2024-05-15 09:00

beforeAll(async () => {
  // Load real Excel fixture
  await excelService.loadFromFile(FIXTURE_PATH);

  // Freeze Date construction in scheduleParser by patching global Date
  // We only need to freeze *new Date()* calls inside the controller/parser
  jest.useFakeTimers({ now: FIXED_NOW.getTime() });
});

afterAll(() => {
  jest.useRealTimers();
});

// ════════════════════════════════════════════════════════════════════════════
describe('GET /api/current-tasks', () => {

  test('returns 200 with success:true and correct shape', async () => {
    const res = await request(app).get('/api/current-tasks?sheet=tax');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sheet).toBe('tax');
    expect(typeof res.body.count).toBe('number');
    expect(typeof res.body.serverTime).toBe('string');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('returns 22 rows for Tax sheet (matches test fixture)', async () => {
    const res = await request(app).get('/api/current-tasks?sheet=tax');
    expect(res.body.count).toBe(22);
    expect(res.body.data.length).toBe(22);
  });

  test('returns 22 rows for Benefits sheet', async () => {
    const res = await request(app).get('/api/current-tasks?sheet=benefits');
    expect(res.body.count).toBe(22);
  });

  test('defaults to tax when no sheet param provided', async () => {
    const res = await request(app).get('/api/current-tasks');
    expect(res.body.sheet).toBe('tax');
  });

  test('every row has a valid currentTask object', async () => {
    const res = await request(app).get('/api/current-tasks?sheet=tax');
    const VALID_STATUSES = ['active', 'upcoming', 'idle', 'unknown'];
    const VALID_FREQS    = ['daily','weekly','biweekly','monthly','quarterly','annual','on_demand','special','unknown'];
    for (const row of res.body.data) {
      const ct = row.currentTask;
      expect(ct).toBeDefined();
      expect(VALID_STATUSES).toContain(ct.status);
      expect(VALID_FREQS).toContain(ct.frequency);
      expect(typeof ct.description).toBe('string');
      expect(ct.description.length).toBeGreaterThan(0);
      // nextRun is either null or a valid ISO string
      if (ct.nextRun !== null) {
        expect(typeof ct.nextRun).toBe('string');
        expect(isNaN(new Date(ct.nextRun).getTime())).toBe(false);
      }
    }
  });

  test('every row retains core batch fields (batchName, scheduleName, sheetSource)', async () => {
    const res = await request(app).get('/api/current-tasks?sheet=tax');
    for (const row of res.body.data) {
      expect(typeof row.batchName).toBe('string');
      expect(row.batchName.length).toBeGreaterThan(0);
      expect(typeof row.scheduleName).toBe('string');
      expect(row.sheetSource).toBe('tax');
    }
  });

  test('benefits_daily_6am is idle at 09:00 (fired 3h ago)', async () => {
    // BatchEnrollmentSync uses benefits_daily_6am — in Benefits sheet
    const res = await request(app).get('/api/current-tasks?sheet=benefits');
    const row = res.body.data.find((r) => r.scheduleName === 'benefits_daily_6am');
    // If this schedule exists in the test data, it must be idle at 09:00
    if (row) {
      expect(row.currentTask.status).toBe('idle');
    }
  });

  test('benefits_daily_9am fired exactly at NOW — nextRun is tomorrow — status idle', async () => {
    const res = await request(app).get('/api/current-tasks?sheet=tax');
    const row = res.body.data.find((r) => r.scheduleName === 'benefits_daily_9am');
    if (row) {
      // At exactly 09:00, d <= now so nextDaily advances to tomorrow → idle
      expect(row.currentTask.status).toBe('idle');
    }
  });

  test('on_demand schedule has status=unknown and nextRun=null', async () => {
    const res = await request(app).get('/api/current-tasks?sheet=benefits');
    const row = res.body.data.find((r) => r.scheduleName === 'on_demand');
    if (row) {
      expect(row.currentTask.status).toBe('unknown');
      expect(row.currentTask.nextRun).toBeNull();
    }
  });

  test('serverTime is a valid ISO string', async () => {
    const res = await request(app).get('/api/current-tasks?sheet=tax');
    const d = new Date(res.body.serverTime);
    expect(isNaN(d.getTime())).toBe(false);
  });
});
