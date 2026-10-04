/**
 * useStatusReport.js — React Query hook for GET /api/status-report.
 *
 * Fetches today's status report rows from the server (which caches the DB2
 * result for 5 minutes). Exposes data, isFetching, isError, and a refresh
 * function that always force-bypasses the server cache and re-queries DB2.
 *
 * React Query v5 note:
 *   When enabled=false and no data exists, the query is "pending + idle"
 *   (not yet triggered). We expose `isFetching` (fetchStatus === 'fetching')
 *   as the real loading indicator so consumers can tell the difference between
 *   "disabled" and "actively loading".
 *
 * Usage:
 *   const { data, isFetching, isIdle, isError, error, refresh } = useStatusReport(enabled);
 *   refresh()  // force=true — server bypasses its cache and re-queries DB2
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStatusReport } from '../services/apiService';
import { STATUS_REPORT_REFRESH_INTERVAL_MS } from '../utils/constants';

const STATUS_REPORT_QUERY_KEY = ['status-report'];

/**
 * @param {boolean} [enabled=false]  Only fetch when true — lazy activation.
 * @returns {{
 *   data:       { data: Object[], cacheHit: boolean, cachedAt: string } | undefined,
 *   isFetching: boolean,   // true only while a real network request is in-flight
 *   isIdle:     boolean,   // true when enabled=false and no data exists yet
 *   isError:    boolean,
 *   error:      Error | null,
 *   refresh:    () => void,  // always force-bypasses server cache
 * }}
 */
export function useStatusReport(enabled = false) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey:             STATUS_REPORT_QUERY_KEY,
    queryFn:              () => fetchStatusReport(false),
    enabled,
    staleTime:            0,
    refetchInterval:      enabled ? STATUS_REPORT_REFRESH_INTERVAL_MS : false,
    refetchOnWindowFocus: false,
    retry:                1,
  });

  /**
   * Force-refresh: removes the cached query entry then re-fetches with
   * force=true so the server bypasses its own 5-minute cache and hits DB2.
   */
  const refresh = () => {
    queryClient.removeQueries({ queryKey: STATUS_REPORT_QUERY_KEY });
    queryClient.fetchQuery({
      queryKey: STATUS_REPORT_QUERY_KEY,
      queryFn:  () => fetchStatusReport(true),
    });
  };

  return {
    data:       query.data,
    // isFetching is true only when a request is actually in-flight
    isFetching: query.fetchStatus === 'fetching',
    // isIdle: query is disabled and has no data — "not yet activated"
    isIdle:     query.isPending && query.fetchStatus === 'idle',
    isError:    query.isError,
    error:      query.error,
    refresh,
  };
}
