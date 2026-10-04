/**
 * triggerNeeded.test.js — unit tests for the Trigger Needed field
 *
 * Covers:
 *   1. batchModel.createBatch — normTrigger normalisation
 *   2. columnMapping.config   — 'Trigger Needed' key is present
 *   3. Integration — field appears in GET /api/batches response after
 *      loading a fixture that contains the column
 */

'use strict';

const path = require('path');

require('dotenv').config();

// ── 1. Model unit tests ───────────────────────────────────────────────────────

const { createBatch } = require('../server/models/batchModel');

const BASE_RAW = {
  batchName:    'TestBatch',
  arguments:    '',
  scheduleName: 'on_demand',
  sheetSource:  'benefits',
  logDir:       'cd /opt/app/bin',
};

describe('createBatch — triggerNeeded normalisation', () => {

  // ── Truthy → 'Y' ──────────────────────────────────────────────────────────
  test('"Y" → "Y"',    () => expect(createBatch({ ...BASE_RAW, triggerNeeded: 'Y'    }).triggerNeeded).toBe('Y'));
  test('"y" → "Y"',    () => expect(createBatch({ ...BASE_RAW, triggerNeeded: 'y'    }).triggerNeeded).toBe('Y'));
  test('"yes" → "Y"',  () => expect(createBatch({ ...BASE_RAW, triggerNeeded: 'yes'  }).triggerNeeded).toBe('Y'));
  test('"YES" → "Y"',  () => expect(createBatch({ ...BASE_RAW, triggerNeeded: 'YES'  }).triggerNeeded).toBe('Y'));
  test('"true" → "Y"', () => expect(createBatch({ ...BASE_RAW, triggerNeeded: 'true' }).triggerNeeded).toBe('Y'));

  // ── Falsy → 'N' ───────────────────────────────────────────────────────────
  test('"N" → "N"',     () => expect(createBatch({ ...BASE_RAW, triggerNeeded: 'N'     }).triggerNeeded).toBe('N'));
  test('"n" → "N"',     () => expect(createBatch({ ...BASE_RAW, triggerNeeded: 'n'     }).triggerNeeded).toBe('N'));
  test('"no" → "N"',    () => expect(createBatch({ ...BASE_RAW, triggerNeeded: 'no'    }).triggerNeeded).toBe('N'));
  test('"NO" → "N"',    () => expect(createBatch({ ...BASE_RAW, triggerNeeded: 'NO'    }).triggerNeeded).toBe('N'));
  test('"false" → "N"', () => expect(createBatch({ ...BASE_RAW, triggerNeeded: 'false' }).triggerNeeded).toBe('N'));

  // ── Unknown / empty → '' ─────────────────────────────────────────────────
  test('undefined → ""',     () => expect(createBatch({ ...BASE_RAW                              }).triggerNeeded).toBe(''));
  test('null → ""',          () => expect(createBatch({ ...BASE_RAW, triggerNeeded: null         }).triggerNeeded).toBe(''));
  test('"" → ""',            () => expect(createBatch({ ...BASE_RAW, triggerNeeded: ''           }).triggerNeeded).toBe(''));
  test('"maybe" → ""',       () => expect(createBatch({ ...BASE_RAW, triggerNeeded: 'maybe'      }).triggerNeeded).toBe(''));
  test('"  Y  " → "Y" (trim)', () => expect(createBatch({ ...BASE_RAW, triggerNeeded: '  Y  '   }).triggerNeeded).toBe('Y'));
  test('"  n  " → "N" (trim)', () => expect(createBatch({ ...BASE_RAW, triggerNeeded: '  n  '   }).triggerNeeded).toBe('N'));

  // ── Other batch fields unaffected ─────────────────────────────────────────
  test('triggerNeeded does not affect batchName', () => {
    const b = createBatch({ ...BASE_RAW, triggerNeeded: 'Y' });
    expect(b.batchName).toBe('TestBatch');
  });

  test('triggerNeeded field present even when absent from raw', () => {
    const b = createBatch(BASE_RAW);
    expect(b).toHaveProperty('triggerNeeded');
  });
});

// ── 2. Column mapping config ──────────────────────────────────────────────────

const { COLUMN_MAP } = require('../server/config/columnMapping.config');

describe('columnMapping.config — Trigger Needed entry', () => {
  test('"Trigger Needed" key exists in COLUMN_MAP', () => {
    expect(COLUMN_MAP).toHaveProperty('Trigger Needed');
  });

  test('"Trigger Needed" maps to "triggerNeeded"', () => {
    expect(COLUMN_MAP['Trigger Needed']).toBe('triggerNeeded');
  });
});

// ── 3. Integration — field in API response ────────────────────────────────────

const request    = require('supertest');
const express    = require('express');

const excelService     = require('../server/services/excelService');
const batchRoutes      = require('../server/routes/batchRoutes');
const { errorHandler } = require('../server/middlewares/errorHandler');

const FIXTURE_PATH = path.resolve(__dirname, '../data/batches.xlsx');

const app = express();
app.use(express.json());
app.use('/api', batchRoutes);
app.use(errorHandler);

beforeAll(async () => {
  await excelService.loadFromFile(FIXTURE_PATH);
});

describe('GET /api/batches — triggerNeeded in API response', () => {

  test('every benefits row has a triggerNeeded field', async () => {
    const res = await request(app).get('/api/batches?sheet=benefits');
    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      expect(row).toHaveProperty('triggerNeeded');
    }
  });

  test('every tax row has a triggerNeeded field', async () => {
    const res = await request(app).get('/api/batches?sheet=tax');
    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      expect(row).toHaveProperty('triggerNeeded');
    }
  });

  test('triggerNeeded values are only "Y", "N", or ""', async () => {
    const res = await request(app).get('/api/batches');
    for (const row of res.body.data) {
      expect(['Y', 'N', '']).toContain(row.triggerNeeded);
    }
  });

  test('at least one benefits row has triggerNeeded="Y"', async () => {
    const res = await request(app).get('/api/batches?sheet=benefits');
    const hasY = res.body.data.some((r) => r.triggerNeeded === 'Y');
    expect(hasY).toBe(true);
  });

  test('at least one benefits row has triggerNeeded="N"', async () => {
    const res = await request(app).get('/api/batches?sheet=benefits');
    const hasN = res.body.data.some((r) => r.triggerNeeded === 'N');
    expect(hasN).toBe(true);
  });

  test('at least one tax row has triggerNeeded="Y"', async () => {
    const res = await request(app).get('/api/batches?sheet=tax');
    const hasY = res.body.data.some((r) => r.triggerNeeded === 'Y');
    expect(hasY).toBe(true);
  });

  test('at least one tax row has triggerNeeded="N"', async () => {
    const res = await request(app).get('/api/batches?sheet=tax');
    const hasN = res.body.data.some((r) => r.triggerNeeded === 'N');
    expect(hasN).toBe(true);
  });
});
