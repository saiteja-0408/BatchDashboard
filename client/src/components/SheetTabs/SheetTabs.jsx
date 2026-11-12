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
        Exact reproduction of the blue handshake glyph:
        - Rounded sleeve/cuff on the left
        - Rounded sleeve/cuff on the right
        - Interlocking fingers and palm in solid blue
        - Characteristic rounded inner loop cut-out
      */}
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 4 5 C 1.8 5 0 6.8 0 9 L 0 13 C 0 15.2 1.8 17 4 17 L 8 17 C 8.6 17 9.1 16.8 9.5 16.4 L 14.5 21.4 C 15.8 22.7 17.6 23.4 19.4 23.2 C 21.2 23 22.8 21.9 23.6 20.3 L 28 20.3 C 30.2 20.3 32 18.5 32 16.3 L 32 12.3 C 32 10.1 30.2 8.3 28 8.3 L 23.5 8.3 C 23.1 8.3 22.7 8.5 22.4 8.8 L 19.3 5.7 C 17.6 4 15 3.3 12.7 4.1 L 8 5 L 4 5 Z M 16.8 9.2 C 16.2 8.6 15.2 8.6 14.6 9.2 C 14 9.8 14 10.8 14.6 11.4 L 17.6 14.4 C 18.2 15 19.2 15 19.8 14.4 C 20.4 13.8 20.4 12.8 19.8 12.2 L 16.8 9.2 Z"
      />
      {/* Precision inner whitespace contour matching the image */}
      <path
        d="M 18.5 13.5 L 15.5 10.5 C 14.7 9.7 13.3 9.7 12.5 10.5 C 11.7 11.3 11.7 12.7 12.5 13.5 L 14.5 15.5"
        fill="none"
        stroke="var(--mui-palette-background-paper, #ffffff)"
        strokeWidth="1.8"
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
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, minWidth: 0 }}>
      <Tabs
        value={activeSheet}
        onChange={handleChange}
        aria-label="Sheet selector"
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
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
