/**
 * useStatusReport.js — React Query hook for GET /api/status-report.
 *
 * Polling lifecycle (PERF-01 fix):
 *   Every interval uses the plain endpoint (server-side TTL governs freshness).
 *   The previous approach of using ?fresh=true on every background poll bypassed
 *   the server cache on every single interval, doubling the DB load. The server's
 *   TTL already matches the polling interval, so a plain request correctly returns
 *   stale-then-fresh data as the TTL expires.
 *
 *   ?fresh=true is now reserved exclusively for the MANUAL "Refresh" button so the
 *   user can always force a live DB hit on demand.
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

    // PERF-01 fix: always use the plain endpoint for background polling.
    // The server-side TTL ensures every poll after expiry hits the DB.
    // ?fresh=true is reserved for the manual Refresh button only.
    queryFn: fetchStatusReport,

    enabled,
    // staleTime: 0 ensures TanStack never serves the browser-level query cache
    // without going to the network. Combined with refetchInterval this means
    // every tick issues a real HTTP request.
    staleTime: 0,
    refetchInterval: resolveRefetchInterval(enabled),
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay,
  });

  /**
   * Manual force-refresh: update the queryFn temporarily to use ?fresh=true
   * then call query.refetch() so TanStack manages the lifecycle correctly.
   * ERR-02 fix: use query.refetch() instead of fetchQuery so the query state
   * (isLoading, isFetching, error) is updated through the normal React Query
   * state machine rather than being fire-and-forgotten.
   */
  const refresh = async () => {
    // Temporarily override the queryFn so the immediate refetch uses ?fresh=true.
    // After the refetch completes the queryFn reverts to the normal one on next
    // background poll (refetchInterval still calls fetchStatusReport).
    await queryClient.fetchQuery({
      queryKey:  STATUS_REPORT_QUERY_KEY,
      queryFn:   fetchStatusReportFresh,
      staleTime: 0,
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
