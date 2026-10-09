/**
 * App.jsx — root component: routing and layout shell.
 * Only the Dashboard route is needed for this application.
 *
 * Performance:
 *   - Dashboard is lazy-loaded (code-split) so the modal bundle is not
 *     downloaded until the user first navigates to the page.
 *   - QueryClient is created outside the component so it is never recreated.
 *
 * Persistence:
 *   - Both Benefits and Tax batch data are prefetched into the React Query
 *     cache on app mount (see BatchPrefetcher below).  This means switching
 *     to either tab is instant — no loading spinner — on every page load or
 *     browser refresh, because the server already has the data in memory from
 *     the persisted Excel files in data/.
 */

import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Box, CircularProgress }           from '@mui/material';

import { AppThemeProvider } from './context/ThemeContext';
import { BatchProvider }    from './context/BatchContext';
import { fetchAllBatches }  from './services/apiService';

// Lazy-load Dashboard (and transitively BatchDetailModal) — deferred until first render
const Dashboard = lazy(() => import('./pages/Dashboard'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Prefetches both Benefits and Tax batch data into the React Query cache as
 * soon as the app mounts.  Uses the same query key ['batches', 'all'] that
 * useAllBatches uses, so the data is immediately available when the user
 * switches to either tab — no loading state, no extra network request.
 *
 * This component renders nothing — it exists purely for the side-effect.
 * It is intentionally placed inside QueryClientProvider so it can call
 * useQueryClient(), but outside BatchProvider / Dashboard so the prefetch
 * fires before any tab-specific query is enabled.
 */
function BatchPrefetcher() {
  const qc = useQueryClient();

  useEffect(() => {
    // prefetchQuery only fires a network request if the cache is empty or stale.
    // On a browser refresh the in-memory cache is wiped, so this always fetches
    // once on first mount — populating data for both Benefits and Tax instantly.
    qc.prefetchQuery({
      queryKey: ['batches', 'all'],
      queryFn:  () => fetchAllBatches(),
      staleTime: 5 * 60_000,
    }).catch(() => {
      // Prefetch errors are non-fatal — the individual tab will retry on demand
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BatchPrefetcher />
      <AppThemeProvider>
        <BatchProvider>
          <BrowserRouter>
            {/*
             * height: '100%' inherits from #root (set to 100% in index.html).
             * display flex + flexDirection column means AppHeader takes its
             * natural height and the Routes area gets flex:1 to fill the rest.
             */}
            <Box
              sx={{
                height:        '100%',
                display:       'flex',
                flexDirection: 'column',
                bgcolor:       'background.default',
              }}
            >
              <Suspense fallback={
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                  <CircularProgress />
                </Box>
              }>
                {/*
                 * flex:1 + minHeight:0 — the Routes wrapper grows to fill all
                 * space left after the AppHeader, and minHeight:0 lets it shrink
                 * below its content height so the table inside can scroll rather
                 * than push the page taller.
                 */}
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                  </Routes>
                </Box>
              </Suspense>
            </Box>
          </BrowserRouter>
        </BatchProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}
