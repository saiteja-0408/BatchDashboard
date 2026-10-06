/**
 * useStatusReport.js — React Query hook for GET /api/status-report.
 *
 * Polling lifecycle:
 *   1. Initial load  → fetchStatusReport()        (plain, may be served from cache)
 *   2. Every interval → fetchStatusReportFresh()  (?fresh=true, always hits DB)
 *
 * This two-function approach guarantees:
 *   - The first render is fast (cache hit is fine for the initial view)
 *   - Every subsequent poll after STATUS_REPORT_REFRESH_INTERVAL_MS executes a
 *     real database query, so the UI never shows data older than one interval
 *
 * Polling can be disabled by setting VITE_STATUS_REPORT_REFRESH_INTERVAL_MS=0.
 *
 * Retry / error guard:
 *   - retry: 1  — one automatic retry on transient network/DB errors
 *   - retryDelay: exponential back-off (1 s, 2 s) to avoid polling storms
 *   - refetchOnWindowFocus: false — prevents a storm of requests when the user
 *     returns to the tab after the DB was temporarily unreachable
 *
 * React Query v5 note:
 *   When enabled=false and no data exists, the query is "pending + idle"
 *   (not yet triggered). We expose `isFetching` (fetchStatus === 'fetching')
 *   as the real loading indicator so consumers can tell the difference between
 *   "disabled" and "actively loading".
 *
 * Usage:
 *   const { data, isFetching, isIdle, isError, error, refresh } = useStatusReport(enabled);
 *   refresh()  // force-bypasses the server cache and re-queries DB immediately
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStatusReport, fetchStatusReportFresh } from '../services/apiService';
import { STATUS_REPORT_REFRESH_INTERVAL_MS } from '../utils/constants';

const STATUS_REPORT_QUERY_KEY = ['status-report'];

/**
 * Exponential back-off for retries: attempt 0 → 1 s, attempt 1 → 2 s.
 * Caps at 2 s so the UI recovers quickly once the DB is reachable again.
 * @param {number} attempt  0-based retry attempt index
 * @returns {number}  Delay in ms
 */
function retryDelay(attempt) {
  return Math.min(1_000 * Math.pow(2, attempt), 2_000);
}

/**
 * Polling interval for refetchInterval.
 * TanStack Query accepts `false` to disable background polling, so we map the
 * special value 0 (user opted out) to false here.
 *
 * @param {boolean} enabled  Whether the tab is active
 * @returns {number | false}
 */
function resolveRefetchInterval(enabled) {
  if (!enabled) return false;
  // STATUS_REPORT_REFRESH_INTERVAL_MS === 0 means polling is disabled
  if (STATUS_REPORT_REFRESH_INTERVAL_MS === 0) return false;
  return STATUS_REPORT_REFRESH_INTERVAL_MS;
}

/**
 * @param {boolean} [enabled=false]  Only fetch when true — lazy activation.
 * @returns {{
 *   data:       { data: Object[], cacheHit: boolean, cachedAt: string } | undefined,
 *   isFetching: boolean,   // true only while a real network request is in-flight
 *   isIdle:     boolean,   // true when enabled=false and no data exists yet
 *   isError:    boolean,
 *   error:      Error | null,
 *   refresh:    () => void,  // immediately bypasses server cache and re-queries DB
 * }}
 */
export function useStatusReport(enabled = false) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: STATUS_REPORT_QUERY_KEY,

    /**
     * queryFn strategy:
     *   - On the initial fetch (no cached data) use the plain endpoint so the
     *     server can serve a cache hit if one exists (fast first render).
     *   - On every background refetch (triggered by refetchInterval) use the
     *     ?fresh=true endpoint so the DB is queried on every tick regardless of
     *     the server-side cache state.
     *
     * TanStack Query passes a QueryFunctionContext with `meta` and signals but
     * does not distinguish initial vs. background fetches natively. We inspect
     * whether the queryClient already has data for this key: if it does, this
     * is a background refetch and we want fresh data.
     */
    queryFn: () => {
      const cached = queryClient.getQueryData(STATUS_REPORT_QUERY_KEY);
      // No existing data → initial load: allow server cache
      if (cached === undefined) return fetchStatusReport();
      // Data already in client → background poll: bypass server cache
      return fetchStatusReportFresh();
    },

    enabled,
    // staleTime: 0 ensures TanStack never serves the browser-level query cache
    // without going to the network. Combined with refetchInterval this means
    // every tick issues a real HTTP request.
    staleTime: 0,
    // Polling interval source:
    //   VITE_STATUS_REPORT_REFRESH_INTERVAL_MS (env) → parsed by parseStatusReportRefreshInterval()
    //   → exported as STATUS_REPORT_REFRESH_INTERVAL_MS from utils/constants.js
    //   → passed here via resolveRefetchInterval().
    //   Default when env var is absent/invalid: 10,000 ms (10 s).
    //   Set VITE_STATUS_REPORT_REFRESH_INTERVAL_MS=0 to disable auto-polling.
    refetchInterval: resolveRefetchInterval(enabled), // currently: 10 000 ms per .env
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay,
  });

  /**
   * Manual force-refresh: clears the browser query cache then fires an
   * immediate ?fresh=true request so the server also bypasses its cache.
   * Used by the "Refresh" button in the toolbar.
   */
  const refresh = () => {
    queryClient.removeQueries({ queryKey: STATUS_REPORT_QUERY_KEY });
    queryClient.fetchQuery({
      queryKey: STATUS_REPORT_QUERY_KEY,
      queryFn:  () => fetchStatusReportFresh(),
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
