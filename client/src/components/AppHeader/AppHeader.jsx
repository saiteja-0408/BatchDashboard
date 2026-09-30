/**
 * AppHeader.jsx — top navigation bar with branding and dark mode toggle.
 */

import React from 'react';
import {
  AppBar, Toolbar, Typography, IconButton, Tooltip,
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { Link } from 'react-router-dom';
import { useThemeMode } from '../../context/ThemeContext';

export function AppHeader() {
  const { toggleDarkMode, isDark } = useThemeMode();

  return (
    <AppBar position="sticky" elevation={1} color="primary">
      {/*
        Inner Toolbar is constrained to the same max-width as the dashboard
        Container (1600px) so the header content stays aligned with page content
        on 1440p / 4K screens instead of stretching edge-to-edge.
      */}
      <Toolbar
        sx={{
          gap: 2,
          maxWidth: '1600px',
          width: '100%',
          mx: 'auto',
          px: { xs: 1.5, sm: 2, md: 3 },
        }}
      >
        <Typography
          variant="h6"
          component={Link}
          to="/"
          sx={{ textDecoration: 'none', color: 'inherit', flexGrow: 1, fontWeight: 700 }}
        >
          ⚙ Batch Job Dashboard
        </Typography>

        <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IconButton
            color="inherit"
            onClick={toggleDarkMode}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            sx={{ width: 44, height: 44 }}
          >
            {isDark ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
