/**
 * useStatusReport.js — React Query hook for GET /api/status-report.
 *
 * Fetches today's status report rows from the server (which caches the DB2
 * result for 5 minutes). Exposes data, isFetching, isError, and a refetch
 * function that can optionally force-bypass the server cache.
 *
 * React Query v5 note:
 *   When enabled=false and no data exists, the query is "pending + idle"
 *   (not yet triggered). We expose `isFetching` (fetchStatus === 'fetching')
 *   as the real loading indicator so consumers can tell the difference between
 *   "disabled" and "actively loading".
 *
 * Usage:
 *   const { data, isFetching, isIdle, isError, error, refetch } = useStatusReport(enabled);
 *   refetch()      // soft refresh (server may return cached data)
 *   refetch(true)  // force=true — server bypasses its cache and re-queries DB2
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStatusReport } from '../services/apiService';

const STATUS_REPORT_QUERY_KEY = ['status-report'];

/**
 * @param {boolean} [enabled=false]  Only fetch when true — lazy activation.
 * @returns {{
 *   data:       { data: Object[], cacheHit: boolean, cachedAt: string } | undefined,
 *   isFetching: boolean,   // true only while a real network request is in-flight
 *   isIdle:     boolean,   // true when enabled=false and no data exists yet
 *   isError:    boolean,
 *   error:      Error | null,
 *   refetch:    (force?: boolean) => void,
 * }}
 */
export function useStatusReport(enabled = false) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey:             STATUS_REPORT_QUERY_KEY,
    queryFn:              () => fetchStatusReport(false),
    enabled,
    staleTime:            0,
    refetchOnWindowFocus: false,
  });

  /**
   * Triggers a fresh fetch.
   * @param {boolean} [force=false]  When true, tells the server to bypass its
   *                                  in-memory cache and re-query DB2.
   */
  const refetch = (force = false) => {
    if (force) {
      queryClient.removeQueries({ queryKey: STATUS_REPORT_QUERY_KEY });
      queryClient.fetchQuery({
        queryKey: STATUS_REPORT_QUERY_KEY,
        queryFn:  () => fetchStatusReport(true),
      });
    } else {
      query.refetch();
    }
  };

  return {
    data:       query.data,
    // isFetching is true only when a request is actually in-flight
    isFetching: query.fetchStatus === 'fetching',
    // isIdle: query is disabled and has no data — "not yet activated"
    isIdle:     query.isPending && query.fetchStatus === 'idle',
    isError:    query.isError,
    error:      query.error,
    refetch,
  };
}
