/**
 * useBatches.js — React Query hooks for all batch data fetching.
 *
 * All hooks accept an optional `sheet` param ('benefits' | 'tax').
 * The sheet value is passed as a query param to the server so only
 * the relevant rows are returned.
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchAllBatches,
  fetchSummary,
  searchBatches,
  fetchBatchByName,
  fetchCurrentTasks,
} from '../services/apiService';
import { CURRENT_TASKS_REFRESH_MS } from '../utils/constants';

const STALE_TIME = 60_000; // 1 minute

/**
 * Fetches all batches for a given sheet source.
 * @param {string} sheet - 'benefits' | 'tax'
 */
export function useAllBatches(sheet) {
  return useQuery({
    queryKey:  ['batches', sheet],
    queryFn:   () => fetchAllBatches(sheet),
    staleTime: STALE_TIME,
    // Disable when sheet is null (e.g. Status Report tab is active)
    enabled:   sheet !== null && sheet !== undefined,
  });
}

/** Fetches summary stats for dashboard cards. */
export function useSummary() {
  return useQuery({
    queryKey:  ['batches', 'summary'],
    queryFn:   fetchSummary,
    staleTime: STALE_TIME,
  });
}

/**
 * Searches batches when query is non-empty.
 * @param {string} query
 * @param {string} sheet
 */
export function useSearchBatches(query, sheet) {
  return useQuery({
    queryKey:  ['batches', 'search', query, sheet],
    queryFn:   () => (query ? searchBatches(query, sheet) : fetchAllBatches(sheet)),
    staleTime: STALE_TIME,
    enabled:   true,
  });
}

/**
 * Fetches a single batch by name within a sheet.
 * @param {string|null} name
 * @param {string} sheet
 */
export function useBatchByName(name, sheet) {
  return useQuery({
    queryKey:  ['batches', name, sheet],
    queryFn:   () => fetchBatchByName(name, sheet),
    staleTime: STALE_TIME,
    enabled:   !!name,
  });
}

/**
 * Fetches current-task status for all rows in a sheet.
 * Auto-refetches every CURRENT_TASKS_REFRESH_MS (60s) so the "Current Task"
 * column stays live without a full page reload.
 *
 * @param {string} sheet - 'benefits' | 'tax'
 * @param {boolean} [enabled=true]  Set to false to pause polling
 */
export function useCurrentTasks(sheet, enabled = true) {
  return useQuery({
    queryKey:        ['current-tasks', sheet],
    queryFn:         () => fetchCurrentTasks(sheet),
    staleTime:       CURRENT_TASKS_REFRESH_MS,
    refetchInterval: CURRENT_TASKS_REFRESH_MS,
    enabled:         !!sheet && enabled,
  });
}
