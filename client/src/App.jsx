/**
 * App.jsx — root component: routing and layout shell.
 * Only the Dashboard route is needed for this application.
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box }                             from '@mui/material';

import { AppThemeProvider } from './context/ThemeContext';
import { BatchProvider }    from './context/BatchContext';
import { AppHeader }        from './components/AppHeader/AppHeader';
import Dashboard            from './pages/Dashboard';

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
            <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
              <AppHeader />
              <Routes>
                <Route path="/" element={<Dashboard />} />
              </Routes>
            </Box>
          </BrowserRouter>
        </BatchProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}
