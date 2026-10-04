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
    <SvgIcon {...props} viewBox="0 0 32 22">
      {/*
        Exact geometric silhouette of the reference handshake logo:
        - Flat horizontal rounded cuff bars on the left and right sides
        - Center interlocking handshake angled at 45 degrees
        - Distinctive curved white boundary loop wrapping over the top knuckle down into the clasp
      */}
      {/* Left horizontal cuff bar */}
      <rect x="0" y="7" width="8.5" height="8" rx="3.5" fill="currentColor" />
      {/* Right horizontal cuff bar */}
      <rect x="23.5" y="7" width="8.5" height="8" rx="3.5" fill="currentColor" />
      {/* Clasping hand shape */}
      <path
        fill="currentColor"
        d="M 6.5,7.2 L 13.8,1.6 C 15.4,0.4 17.6,0.6 19,2 L 20.8,3.8 C 22.2,5.2 22.2,7.4 20.8,8.8 L 19.4,10.2 L 20.5,11.3 C 21.1,11.9 21.1,12.9 20.5,13.5 C 19.9,14.1 18.9,14.1 18.3,13.5 L 17.8,13 L 19.5,14.7 C 20.1,15.3 20.1,16.3 19.5,16.9 C 18.9,17.5 17.9,17.5 17.3,16.9 L 15.5,15.1 L 16.5,16.1 C 17.1,16.7 17.1,17.7 16.5,18.3 C 15.9,18.9 14.9,18.9 14.3,18.3 L 11.5,15.5 L 6.5,14.8 Z"
      />
      <path
        fill="currentColor"
        d="M 25.5,14.8 L 18.2,20.4 C 16.6,21.6 14.4,21.4 13,20 L 11.2,18.2 C 9.8,16.8 9.8,14.6 11.2,13.2 L 12.6,11.8 L 11.5,10.7 C 10.9,10.1 10.9,9.1 11.5,8.5 C 12.1,7.9 13.1,7.9 13.7,8.5 L 14.2,9 L 12.5,7.3 C 11.9,6.7 11.9,5.7 12.5,5.1 C 13.1,4.5 14.1,4.5 14.7,5.1 L 16.5,6.9 L 15.5,5.9 C 14.9,5.3 14.9,4.3 15.5,3.7 C 16.1,3.1 17.1,3.1 17.7,3.7 L 20.5,6.5 L 25.5,7.2 Z"
      />
      {/* White dividing channel curve between clasping hands */}
      <path
        d="M 13.2 9.5 C 12.1 10.6 12.1 12.4 13.2 13.5 C 14.3 14.6 16.1 14.6 17.2 13.5 L 20.4 10.3"
        fill="none"
        stroke="var(--mui-palette-background-paper, #ffffff)"
        strokeWidth="1.5"
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
