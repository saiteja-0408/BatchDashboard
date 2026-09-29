/**
 * useBatches.js — React Query hooks for all batch data fetching.
 *
 * Centralises query keys, stale times, and refetch strategies.
 * Components use these hooks instead of calling apiService directly.
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchAllBatches,
  fetchSummary,
  searchBatches,
  filterBatches,
  fetchBatchById,
} from '../services/apiService';

const STALE_TIME = 60_000; // 1 minute — batch data doesn't change rapidly

/** Fetches all batches (used as the base list when no search/filter is active). */
export function useAllBatches() {
  return useQuery({
    queryKey: ['batches'],
    queryFn:  fetchAllBatches,
    staleTime: STALE_TIME,
  });
}

/** Fetches summary stats for dashboard cards. */
export function useSummary() {
  return useQuery({
    queryKey: ['batches', 'summary'],
    queryFn:  fetchSummary,
    staleTime: STALE_TIME,
  });
}

/**
 * Searches batches when query is non-empty; returns all batches otherwise.
 * @param {string} query
 */
export function useSearchBatches(query) {
  return useQuery({
    queryKey: ['batches', 'search', query],
    queryFn:  () => (query ? searchBatches(query) : fetchAllBatches()),
    staleTime: STALE_TIME,
    enabled: true,
  });
}

/**
 * Filters batches. Skips the API call if all filter values are empty.
 * @param {{ domain?: string, frequency?: string, status?: string }} filters
 */
export function useFilterBatches(filters) {
  const hasFilter = Object.values(filters).some(Boolean);
  return useQuery({
    queryKey: ['batches', 'filter', filters],
    queryFn:  () => (hasFilter ? filterBatches(filters) : fetchAllBatches()),
    staleTime: STALE_TIME,
  });
}

/**
 * Fetches a single batch by ID.
 * @param {string|null} id
 */
export function useBatchById(id) {
  return useQuery({
    queryKey: ['batches', id],
    queryFn:  () => fetchBatchById(id),
    staleTime: STALE_TIME,
    enabled:  !!id,
  });
}
