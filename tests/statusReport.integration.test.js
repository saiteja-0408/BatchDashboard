/**
 * statusReport.integration.test.js
 *
 * Tests for GET /api/status-report covering:
 *   1. Successful fetch (DB2 returns rows) — cache-miss path
 *   2. Cache-hit path (second request within TTL)
 *   3. force=true bypasses cache and re-queries DB2
 *   4. DB2 error handling (structured JSON error, 503 status)
 *   5. ibm_db driver not installed — 503 with descriptive message
 *
 * Strategy:
 *   - db2Service is mocked so no real DB2 connection is needed.
 *   - cacheService is imported directly so we can clear it between tests.
 *   - A minimal Express app is built (same pattern as currentTasks tests).
 */

'use strict';

const request       = require('supertest');
const express       = require('express');
const { errorHandler } = require('../server/middlewares/errorHandler');

// ── Cache must be cleared between tests to ensure deterministic behaviour ────
const cache = require('../server/services/cacheService');

// ── Mock db2Service so we never need a real DB2 connection ───────────────────
jest.mock('../server/services/db2Service');
const db2Service = require('../server/services/db2Service');

// ── Build test Express app ────────────────────────────────────────────────────
const batchRoutes = require('../server/routes/batchRoutes');

const app = express();
app.use(express.json());
app.use('/api', batchRoutes);
app.use(errorHandler);

// ── Sample rows matching the DB2 schema ──────────────────────────────────────
const SAMPLE_ROWS = [
  {
    job_name:         'BatchGetDd214Response',
    job_group:        'on_demand',
    start_time:       '2024-05-15T10:46:29.000Z',
    end_time:         '2024-05-15T11:17:20.000Z',
    next_fire_time:   null,
    biz_error_flag:   'Y',
    error_flag:       'N',
    killed_flag:      'N',
    parent_job_name:  null,
    parent_job_group: null,
  },
  {
    job_name:         'BatchEnrollmentSync',
    job_group:        'benefits_daily_6am',
    start_time:       '2024-05-15T06:00:00.000Z',
    end_time:         '2024-05-15T06:05:00.000Z',
    next_fire_time:   '2024-05-16T06:00:00.000Z',
    biz_error_flag:   'N',
    error_flag:       'N',
    killed_flag:      'N',
    parent_job_name:  null,
    parent_job_group: null,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Clear cache before each test for isolation
  cache.clear();
  // Reset all mock state
  jest.clearAllMocks();
});

afterAll(() => {
  cache.clear();
});

// ════════════════════════════════════════════════════════════════════════════
describe('GET /api/status-report', () => {

  // ── 1. Successful cache-miss fetch ──────────────────────────────────────
  describe('cache-miss path (first request)', () => {
    beforeEach(() => {
      db2Service.queryDb2.mockResolvedValue(SAMPLE_ROWS);
    });

    test('returns 200 with success:true and correct envelope shape', async () => {
      const res = await request(app).get('/api/status-report');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.count).toBe('number');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.cachedAt).toBe('string');
      expect(typeof res.body.cacheHit).toBe('boolean');
    });

    test('returns all rows from DB2', async () => {
      const res = await request(app).get('/api/status-report');
      expect(res.body.count).toBe(2);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].job_name).toBe('BatchGetDd214Response');
    });

    test('cacheHit is false on first request', async () => {
      const res = await request(app).get('/api/status-report');
      expect(res.body.cacheHit).toBe(false);
    });

    test('cache-hit response header is "false" on first request', async () => {
      const res = await request(app).get('/api/status-report');
      expect(res.headers['cache-hit']).toBe('false');
    });

    test('calls queryDb2 exactly once', async () => {
      await request(app).get('/api/status-report');
      expect(db2Service.queryDb2).toHaveBeenCalledTimes(1);
    });

    test('cachedAt is a valid ISO timestamp', async () => {
      const res = await request(app).get('/api/status-report');
      const d = new Date(res.body.cachedAt);
      expect(isNaN(d.getTime())).toBe(false);
    });
  });

  // ── 2. Cache-hit path (second request within TTL) ───────────────────────
  describe('cache-hit path (subsequent request within TTL)', () => {
    beforeEach(async () => {
      db2Service.queryDb2.mockResolvedValue(SAMPLE_ROWS);
      // Prime the cache with a first request
      await request(app).get('/api/status-report');
      jest.clearAllMocks(); // reset call count before the assertion request
    });

    test('returns the same data without calling queryDb2', async () => {
      const res = await request(app).get('/api/status-report');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(db2Service.queryDb2).not.toHaveBeenCalled();
    });

    test('cacheHit is true on second request', async () => {
      const res = await request(app).get('/api/status-report');
      expect(res.body.cacheHit).toBe(true);
    });

    test('cache-hit response header is "true" on second request', async () => {
      const res = await request(app).get('/api/status-report');
      expect(res.headers['cache-hit']).toBe('true');
    });
  });

  // ── 3. force=true bypasses cache ────────────────────────────────────────
  describe('force=true cache bypass', () => {
    const REFRESHED_ROWS = [
      { ...SAMPLE_ROWS[0], biz_error_flag: 'N' }, // changed flag
    ];

    beforeEach(async () => {
      db2Service.queryDb2.mockResolvedValueOnce(SAMPLE_ROWS);
      // Prime cache
      await request(app).get('/api/status-report');
      // Second DB2 call returns different (fresher) data
      db2Service.queryDb2.mockResolvedValueOnce(REFRESHED_ROWS);
    });

    test('queries DB2 even though cache is warm', async () => {
      await request(app).get('/api/status-report?force=true');
      expect(db2Service.queryDb2).toHaveBeenCalledTimes(2); // prime + force
    });

    test('returns fresh data from DB2, not cached data', async () => {
      const res = await request(app).get('/api/status-report?force=true');
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].biz_error_flag).toBe('N');
    });

    test('cacheHit is false when force=true', async () => {
      const res = await request(app).get('/api/status-report?force=true');
      expect(res.body.cacheHit).toBe(false);
    });

    test('refreshed data is cached — next normal request is a cache hit', async () => {
      await request(app).get('/api/status-report?force=true');
      jest.clearAllMocks();
      const res = await request(app).get('/api/status-report');
      expect(res.body.cacheHit).toBe(true);
      expect(db2Service.queryDb2).not.toHaveBeenCalled();
    });
  });

  // ── 4. DB2 query error ───────────────────────────────────────────────────
  describe('DB2 error handling', () => {
    beforeEach(() => {
      const dbErr = new Error('DB2 connection refused');
      dbErr.status = 503;
      db2Service.queryDb2.mockRejectedValue(dbErr);
    });

    test('returns 503 when DB2 query throws', async () => {
      const res = await request(app).get('/api/status-report');
      expect(res.status).toBe(503);
    });

    test('returns structured JSON error body', async () => {
      const res = await request(app).get('/api/status-report');
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(typeof res.body.error.message).toBe('string');
      expect(res.body.error.message).toContain('DB2 connection refused');
    });

    test('does not cache failed results', async () => {
      await request(app).get('/api/status-report');
      // Cache should still be empty after an error
      const hit = cache.get('status_report_today');
      expect(hit).toBeNull();
    });
  });

  // ── 5. Generic DB2 query error (non-503) ────────────────────────────────
  describe('generic query error', () => {
    test('returns 500 for unexpected errors', async () => {
      db2Service.queryDb2.mockRejectedValue(new Error('Unexpected failure'));
      const res = await request(app).get('/api/status-report');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

});

// ════════════════════════════════════════════════════════════════════════════
describe('cacheService unit tests', () => {

  beforeEach(() => cache.clear());

  test('set + get returns the stored value within TTL', () => {
    cache.set('k', [1, 2, 3], 60_000);
    const hit = cache.get('k');
    expect(hit).not.toBeNull();
    expect(hit.value).toEqual([1, 2, 3]);
    expect(hit.cachedAt).toBeInstanceOf(Date);
  });

  test('get returns null for missing key', () => {
    expect(cache.get('nope')).toBeNull();
  });

  test('get returns null after TTL expires', () => {
    cache.set('exp', 'data', 1); // 1ms TTL
    return new Promise((resolve) => setTimeout(() => {
      expect(cache.get('exp')).toBeNull();
      resolve();
    }, 10));
  });

  test('del removes the entry', () => {
    cache.set('d', 'val');
    cache.del('d');
    expect(cache.get('d')).toBeNull();
  });

  test('clear empties all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  test('DEFAULT_TTL_MS is 5 minutes', () => {
    expect(cache.DEFAULT_TTL_MS).toBe(5 * 60 * 1000);
  });
});
