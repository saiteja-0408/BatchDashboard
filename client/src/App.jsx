/**
 * App.jsx — root component: routing and layout shell.
 * Only the Dashboard route is needed for this application.
 *
 * Performance:
 *   - Dashboard is lazy-loaded (code-split) so the modal bundle is not
 *     downloaded until the user first navigates to the page.
 *   - QueryClient is created outside the component so it is never recreated.
 */

import React, { lazy, Suspense, Component } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box, CircularProgress, Typography, Button } from '@mui/material';

import { AppThemeProvider } from './context/ThemeContext';
import { BatchProvider }    from './context/BatchContext';

// Lazy-load Dashboard (and transitively BatchDetailModal) — deferred until first render
const Dashboard = lazy(() => import('./pages/Dashboard'));

/**
 * ERR-01: top-level React error boundary.
 * Catches rendering errors that escape individual component try/catch blocks and
 * displays a user-friendly fallback instead of a blank page.
 */
class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh" gap={2} p={4}>
          <Typography variant="h6" color="error">Something went wrong</Typography>
          <Typography variant="body2" color="text.secondary">{this.state.errorMessage}</Typography>
          <Button variant="outlined" onClick={() => window.location.reload()}>Reload page</Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

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
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider>
          <BatchProvider>
            <BrowserRouter>
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
    </AppErrorBoundary>
  );
}
