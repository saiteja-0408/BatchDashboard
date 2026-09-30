/**
 * apiService.js — thin Axios wrapper for all backend API calls.
 *
 * All components interact with the API through these functions —
 * never call Axios directly from a component.
 *
 * Timeouts:
 *   DEFAULT_TIMEOUT_MS  — used for all fast calls (batches, summary, current-tasks)
 *   DB_TIMEOUT_MS       — used for the Status Report call which hits DB2/PG and
 *                         can be slow on first load (cold connection, large result set).
 *                         Change DB_TIMEOUT_MS here to tune without touching any component.
 */

import axios from 'axios';
import { API_PATHS } from '../utils/constants';

const DEFAULT_TIMEOUT_MS = 15_000;  // 15 s — fast in-memory API calls
const DB_TIMEOUT_MS      = 60_000;  // 60 s — DB2 / PostgreSQL queries

const client = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// Unwrap the { success, data } envelope so callers get data directly
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'Unknown error';
    return Promise.reject(new Error(message));
  }
);

/**
 * Fetches all batches, optionally for a specific sheet.
 * @param {string|undefined} sheet - 'benefits' | 'tax' | undefined (all)
 * @returns {Promise<Object[]>}
 */
export async function fetchAllBatches(sheet) {
  const res = await client.get(API_PATHS.batches, {
    params: sheet ? { sheet } : {},
  });
  return res.data.data;
}

/**
 * Fetches dashboard summary statistics.
 * @returns {Promise<Object>}
 */
export async function fetchSummary() {
  const res = await client.get(API_PATHS.summary);
  return res.data.data;
}

/**
 * Searches batches by a free-text query.
 * @param {string} query
 * @param {string|undefined} sheet
 * @returns {Promise<Object[]>}
 */
export async function searchBatches(query, sheet) {
  const res = await client.get(API_PATHS.search, {
    params: { q: query, ...(sheet ? { sheet } : {}) },
  });
  return res.data.data;
}

/**
 * Fetches a single batch by batchName within an optional sheet.
 * @param {string} name
 * @param {string|undefined} sheet
 * @returns {Promise<Object>}
 */
export async function fetchBatchByName(name, sheet) {
  const res = await client.get(API_PATHS.batchByName(name, sheet));
  return res.data.data;
}

/**
 * Fetches all batches augmented with current-task status for a given sheet.
 * @param {string} sheet - 'benefits' | 'tax'
 * @returns {Promise<Object[]>}
 */
export async function fetchCurrentTasks(sheet) {
  const res = await client.get(API_PATHS.currentTasks(sheet));
  return res.data;  // return full envelope { success, sheet, count, serverTime, data }
}

/**
 * Fetches the status report data from DB2 (via server-side cache).
 * Pass force=true to bypass the server cache and force a fresh DB2 query.
 *
 * Uses DB_TIMEOUT_MS (60 s) instead of the default 15 s because this call
 * hits DB2 / PostgreSQL on a cold connection and may return a large result set.
 *
 * @param {boolean} [force=false]
 * @returns {Promise<{ data: Object[], cacheHit: boolean, cachedAt: string, count: number }>}
 */
export async function fetchStatusReport(force = false) {
  const res = await client.get(API_PATHS.statusReport(force), {
    timeout: DB_TIMEOUT_MS,
  });
  // Return the full envelope — consumer needs cacheHit + cachedAt
  return res.data;
}

