/**
 * App.jsx — root component: routing and layout shell.
 * Only the Dashboard route is needed for this application.
 *
 * Performance:
 *   - Dashboard is lazy-loaded (code-split) so the modal bundle is not
 *     downloaded until the user first navigates to the page.
 *   - QueryClient is created outside the component so it is never recreated.
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box, CircularProgress }           from '@mui/material';

import { AppThemeProvider } from './context/ThemeContext';
import { BatchProvider }    from './context/BatchContext';

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
