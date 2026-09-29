/**
 * AppHeader.jsx — top navigation bar with branding, dark mode toggle, and upload button.
 */

import React from 'react';
import {
  AppBar, Toolbar, Typography, IconButton, Tooltip, Box,
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { Link } from 'react-router-dom';
import { useThemeMode } from '../../context/ThemeContext';
import { UploadButton } from '../UploadButton/UploadButton';

export function AppHeader() {
  const { toggleDarkMode, isDark } = useThemeMode();

  return (
    <AppBar position="sticky" elevation={1} color="primary">
      <Toolbar sx={{ gap: 2 }}>
        <Typography
          variant="h6"
          component={Link}
          to="/"
          sx={{ textDecoration: 'none', color: 'inherit', flexGrow: 1, fontWeight: 700 }}
        >
          ⚙ Batch Job Dashboard
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <UploadButton />
          <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton color="inherit" onClick={toggleDarkMode} size="small">
              {isDark ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
