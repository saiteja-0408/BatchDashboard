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
    <SvgIcon {...props} viewBox="0 0 48 32">
      {/* Solid handshake silhouette matching the image exact geometry */}
      <path
        fill="currentColor"
        d="M 5 11 C 2.5 11 1 12.5 1 15 L 1 19 C 1 21.5 2.5 23 5 23 L 9.5 23 C 10.8 23 11.8 22.2 12.2 21.2 L 14.5 23.5 C 15.7 24.7 17.3 25.4 19 25.4 L 23.2 25.4 C 23.8 26.5 24.9 27.2 26.2 27.2 L 27.8 27.2 C 29.5 27.2 30.8 25.8 30.8 24.2 C 30.8 23.9 30.7 23.6 30.6 23.4 C 31.8 23.1 32.7 22 32.7 20.6 C 32.7 20.3 32.6 20 32.5 19.8 C 33.7 19.4 34.5 18.3 34.5 17 C 34.5 16.6 34.4 16.3 34.2 16 L 38.5 16 C 41 16 42.5 14.5 42.5 12 L 42.5 8 C 42.5 5.5 41 4 38.5 4 L 34 4 C 32.8 4 31.8 4.7 31.2 5.8 L 29 3.5 C 27.8 2.3 26.2 1.6 24.5 1.6 L 19 1.6 C 16.2 1.6 13.8 3.5 13.1 6.2 L 10.5 8.8 C 10.2 8.7 9.8 8.6 9.5 8.6 L 5 8.6 C 2.5 8.6 1 10.1 1 12.6 L 1 14.4 C 1 14.6 1 14.8 1.1 15 C 1 14.8 1 14.6 1 14.4 Z"
      />
      {/* Characteristic white loop / cane-shaped separation groove */}
      <path
        d="M 27 15.5 L 21.5 10 C 20.4 8.9 18.6 8.9 17.5 10 C 16.4 11.1 16.4 12.9 17.5 14 C 18.6 15.1 20.4 15.1 21.5 14 L 22.8 12.7"
        fill="none"
        stroke="var(--mui-palette-background-paper, #ffffff)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
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
