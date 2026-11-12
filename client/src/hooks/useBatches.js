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
  fetchBatchByName,
  fetchCurrentTasks,
} from '../services/apiService';
import { CURRENT_TASKS_REFRESH_MS } from '../utils/constants';

const STALE_TIME = 5 * 60_000; // 5 minutes cache for static batch data (invalidated on upload)

/**
 * Fetches all batches for all sheets once, or for a specific sheet source.
 *
 * Performance optimization:
 * - When `sheet` is provided (e.g. 'benefits' or 'tax'), it fetches all batches
 *   under the root query key ['batches', 'all'] and uses `select` to filter
 *   the relevant sheet's data client-side.
 * - This ensures both Benefits and Tax sheets are loaded in a single request,
 *   stored in cache once, and switching between Benefits and Tax tabs becomes
 *   an instantaneous, zero-network, zero-flicker client-side view switch.
 *
 * @param {string|null} sheet - 'benefits' | 'tax' | null
 */
export function useAllBatches(sheet) {
  return useQuery({
    queryKey:  ['batches', 'all'],
    queryFn:   () => fetchAllBatches(),
    staleTime: STALE_TIME,
    // Disable when sheet is null (e.g. Status Report tab is active)
    enabled:   sheet !== null && sheet !== undefined,
    select:    (allData) => {
      if (!allData || !Array.isArray(allData)) return [];
      const targetSheet = sheet ? String(sheet).toLowerCase().trim() : null;
      const result = targetSheet
        ? allData.filter((b) => (b.sheetSource || '').toLowerCase().trim() === targetSheet)
        : allData;
      // Log full dataset size on every select so the 1000-row requirement can be
      // verified in the browser console: "Batches loaded: N (sheet: benefits|tax)"
      console.log(`[useAllBatches] Batches loaded: ${result.length} (sheet: ${sheet ?? 'all'})`);
      return result;
    },
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
