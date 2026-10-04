/**
 * SheetTabs.jsx — Benefits / Tax sheet toggle tabs.
 *
 * Reads and writes activeSheet from BatchContext.
 * Switching tabs resets the search query so stale results don't carry over.
 */

import React from 'react';
import { Tabs, Tab, Box, SvgIcon } from '@mui/material';
import AccountBalanceIcon   from '@mui/icons-material/AccountBalance';
import AssessmentIcon       from '@mui/icons-material/Assessment';
import { useBatchContext } from '../../context/BatchContext';
import { SHEET_SOURCES, SHEET_LABELS } from '../../utils/constants';

/**
 * BenefitsHandshakeIcon — Handshake icon matching the provided Benefits logo design:
 * Rounded arms/cuffs on left and right, clasping hands with rounded clasp outline in center.
 * Inherits color via `currentColor` so MUI Tab active/inactive state tokens apply correctly.
 */
function BenefitsHandshakeIcon(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 32 20">
      {/*
        Clean vector matching the Benefits handshake logo:
        - Rounded horizontal wrists / sleeves on left and right
        - Interlocking clasped hands with fingers gripping
        - Characteristic curved cutout notch separating the hands and fingers
      */}
      {/* Left wrist sleeve */}
      <rect x="1" y="6" width="6.5" height="8" rx="2.5" fill="currentColor" />
      {/* Right wrist sleeve */}
      <rect x="24.5" y="6" width="6.5" height="8" rx="2.5" fill="currentColor" />
      {/* Upper hand & thumb wrapping downward */}
      <path
        fill="currentColor"
        d="M 7.5 6.5 C 8.5 4.5 11 3 13.5 3 C 15.2 3 17 3.8 18.5 5.2 L 24.5 10.5 C 25 11 25 12 24.5 12.5 C 24 13 23 13 22.5 12.5 L 18 8.5 C 17.5 8 16.8 8 16.3 8.5 C 15.8 9 15.8 9.8 16.3 10.3 L 19.5 13.5 C 20 14 20 14.8 19.5 15.3 C 19 15.8 18.2 15.8 17.7 15.3 L 15.2 12.8 C 14.7 12.3 13.9 12.3 13.4 12.8 C 12.9 13.3 12.9 14.1 13.4 14.6 L 15 16.2 C 15.4 16.6 15.4 17.3 15 17.7 C 14.6 18.1 13.9 18.1 13.5 17.7 L 10 14.2 C 8.8 13 7.8 11.2 7.5 9.5 Z"
      />
      {/* Lower hand & fingers clasping upward */}
      <path
        fill="currentColor"
        d="M 24.5 13.5 C 23.5 15.5 21 17 18.5 17 C 16.8 17 15 16.2 13.5 14.8 L 7.5 9.5 C 7 9 7 8 7.5 7.5 C 8 7 9 7 9.5 7.5 L 14 11.5 C 14.5 12 15.2 12 15.7 11.5 C 16.2 11 16.2 10.2 15.7 9.7 L 12.5 6.5 C 12 6 12 5.2 12.5 4.7 C 13 4.2 13.8 4.2 14.3 4.7 L 16.8 7.2 C 17.3 7.7 18.1 7.7 18.6 7.2 C 19.1 6.7 19.1 5.9 18.6 5.4 L 17 3.8 C 16.6 3.4 16.6 2.7 17 2.3 C 17.4 1.9 18.1 1.9 18.5 2.3 L 22 5.8 C 23.2 7 24.2 8.8 24.5 10.5 Z"
      />
      {/* Handshake separation contour notch */}
      <path
        d="M 12 9 C 11.5 10.5 12.5 12 14 12.5 L 17 10"
        fill="none"
        stroke="var(--mui-palette-background-paper, #ffffff)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}

const SHEET_ICONS = {
  benefits:        <BenefitsHandshakeIcon fontSize="small" />,
  tax:             <AccountBalanceIcon    fontSize="small" />,
  'status-report': <AssessmentIcon        fontSize="small" />,
};

export function SheetTabs() {
  const { activeSheet, setActiveSheet, clearSearch } = useBatchContext();

  const handleChange = (_, newValue) => {
    setActiveSheet(newValue);
    clearSearch();
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
      <Tabs value={activeSheet} onChange={handleChange} aria-label="Sheet selector">
        {SHEET_SOURCES.map((sheet) => (
          <Tab
            key={sheet}
            value={sheet}
            label={SHEET_LABELS[sheet]}
            icon={SHEET_ICONS[sheet]}
            iconPosition="start"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
        ))}
      </Tabs>
    </Box>
  );
}
