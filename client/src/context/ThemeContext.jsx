/**
 * ThemeContext.jsx — provides MUI theme + dark mode toggle to the entire app.
 */

import React, { createContext, useContext, useState, useMemo } from 'react';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import PropTypes from 'prop-types';

const ThemeContext = createContext({ toggleDarkMode: () => {}, isDark: false });

export function useThemeMode() {
  return useContext(ThemeContext);
}

export function AppThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  const theme = useMemo(
    () =>
      createTheme({
        // ── Custom breakpoints — adds xl2 (1920px) and xl3 (2560px) ─────────
        breakpoints: {
          values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536, xl2: 1920, xl3: 2560 },
        },
        palette: {
          mode: isDark ? 'dark' : 'light',
          primary:   { main: '#1976d2' },
          secondary: { main: '#7c5cd8' },
          background: {
            default: isDark ? '#0d1117' : '#f4f6f9',
            paper:   isDark ? '#161b22' : '#ffffff',
          },
        },
        // ── Fluid typography — scales from mobile through 4K ─────────────────
        // clamp(min, preferred-vw, max) keeps text readable at every viewport.
        typography: {
          fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
          fontSize: 14,
          h4: { fontSize: 'clamp(1.5rem, 2.2vw, 2.4rem)',  fontWeight: 700 },
          h5: { fontSize: 'clamp(1.1rem, 1.4vw, 1.6rem)',  fontWeight: 700 },
          h6: { fontSize: 'clamp(1rem,   1.1vw, 1.3rem)' },
          body1:    { fontSize: 'clamp(0.875rem, 0.9vw, 1rem)' },
          body2:    { fontSize: 'clamp(0.8rem,   0.85vw, 0.95rem)' },
          subtitle2:{ fontSize: 'clamp(0.75rem,  0.8vw,  0.875rem)' },
          caption:  { fontSize: 'clamp(0.65rem,  0.7vw,  0.78rem)' },
        },
        // ── Global component overrides ────────────────────────────────────────
        components: {
          MuiTableCell: {
            styleOverrides: {
              head: { fontWeight: 700 },
              root: {
                '@media (min-width: 1536px)': { paddingLeft: '12px', paddingRight: '12px' },
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                // elevation=0 cards use a single thin border token instead of a
                // drop-shadow so they don't visually double-up on the page background.
                // The border colour adapts automatically to light / dark mode via
                // the theme's divider token (rgba(0,0,0,0.12) / rgba(255,255,255,0.12)).
                '&.MuiPaper-elevation0': {
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                },
                '@media (min-width: 1536px)': { borderRadius: '10px' },
              },
            },
          },
          // Paper elevation=0: same single-border treatment as Card
          MuiPaper: {
            styleOverrides: {
              elevation0: {
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
              },
            },
          },
        },
      }),
    [isDark]
  );

  const toggleDarkMode = () => setIsDark((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ toggleDarkMode, isDark }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}

AppThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
