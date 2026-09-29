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
