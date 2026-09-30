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
        palette: {
          mode: isDark ? 'dark' : 'light',
          primary:   { main: '#1976d2' },
          secondary: { main: '#7c5cd8' },
          background: {
            default: isDark ? '#0d1117' : '#f4f6f9',
            paper:   isDark ? '#161b22' : '#ffffff',
          },
        },
        typography: {
          fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
          fontSize: 14,
          h5: { fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', fontWeight: 700 },
          h6: { fontSize: 'clamp(1rem, 2vw, 1.25rem)' },
          h4: { fontSize: 'clamp(1.5rem, 4vw, 2.125rem)' },
          subtitle2: { fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)' },
          caption: { fontSize: 'clamp(0.65rem, 1.2vw, 0.75rem)' },
        },
        components: {
          MuiTableCell: {
            styleOverrides: {
              head: { fontWeight: 700 },
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
