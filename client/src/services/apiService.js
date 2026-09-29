/**
 * apiService.js — thin Axios wrapper for all backend API calls.
 *
 * All components interact with the API through these functions —
 * never call Axios directly from a component.
 */

import axios from 'axios';
import { API_PATHS } from '../utils/constants';

const client = axios.create({
  timeout: 15000,
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
 * Fetches all batches.
 * @returns {Promise<Object[]>}
 */
export async function fetchAllBatches() {
  const res = await client.get(API_PATHS.batches);
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
 * @returns {Promise<Object[]>}
 */
export async function searchBatches(query) {
  const res = await client.get(API_PATHS.search, { params: { q: query } });
  return res.data.data;
}

/**
 * Filters batches by domain, frequency, and/or status.
 * @param {{ domain?: string, frequency?: string, status?: string }} filters
 * @returns {Promise<Object[]>}
 */
export async function filterBatches(filters) {
  const res = await client.get(API_PATHS.filter, { params: filters });
  return res.data.data;
}

/**
 * Fetches a single batch by ID.
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function fetchBatchById(id) {
  const res = await client.get(API_PATHS.batchById(id));
  return res.data.data;
}

/**
 * Uploads an Excel file to replace the server-side batch store.
 * @param {File} file
 * @returns {Promise<{ count: number, warnings: string[] }>}
 */
export async function uploadExcelFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await client.post(API_PATHS.upload, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
