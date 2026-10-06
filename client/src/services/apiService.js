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
 * Fetches the status report from the server.
 * The server may return a cached result if the cache is still warm.
 * Used for the initial load when the Status Report tab is first opened.
 *
 * @returns {Promise<{ data: Object[], cacheHit: boolean, cachedAt: string, count: number }>}
 */
export async function fetchStatusReport() {
  const res = await client.get(API_PATHS.statusReport(), {
    timeout: DB_TIMEOUT_MS,
  });
  return res.data;
}

/**
 * Fetches the status report with ?fresh=true, bypassing the server-side cache.
 * Used exclusively by the scheduled polling path so every interval tick
 * executes a live database query rather than returning stale cached data.
 *
 * Uses DB_TIMEOUT_MS (60 s) for the same reason as fetchStatusReport.
 *
 * @returns {Promise<{ data: Object[], cacheHit: boolean, cachedAt: string, count: number }>}
 */
export async function fetchStatusReportFresh() {
  const res = await client.get(API_PATHS.statusReportFresh(), {
    timeout: DB_TIMEOUT_MS,
  });
  return res.data;
}

/**
 * Uploads a new .xlsx/.xls file for the given sheet and hot-reloads the
 * in-memory batch store on the server.
 *
 * @param {'benefits'|'tax'} sheet
 * @param {File} file - the File object from the browser's file input
 * @returns {Promise<{ success: boolean, sheet: string, count: number, message: string }>}
 */
export async function uploadSheet(sheet, file) {
  const formData = new FormData();
  formData.append('file', file);
  // Do NOT set Content-Type manually — the browser/Axios must auto-generate the
  // multipart/form-data boundary string. Passing `undefined` leaves the key
  // present in some Axios versions and can suppress the boundary, breaking the
  // upload. Instead, build a headers object without the key entirely.
  const uploadHeaders = { ...client.defaults.headers.common };
  delete uploadHeaders['Content-Type'];
  const res = await client.post(API_PATHS.uploadSheet(sheet), formData, {
    headers: uploadHeaders,
  });
  return res.data;
}

