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
import { AppHeader }        from './components/AppHeader/AppHeader';

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
            <AppHeader />
            <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
              <Suspense fallback={
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                  <CircularProgress />
                </Box>
              }>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                </Routes>
              </Suspense>
            </Box>
          </BrowserRouter>
        </BatchProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}
