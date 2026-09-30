/**
 * SheetTabs.jsx — Benefits / Tax sheet toggle tabs.
 *
 * Reads and writes activeSheet from BatchContext.
 * Switching tabs resets the search query so stale results don't carry over.
 */

import React from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import HealthAndSafetyIcon  from '@mui/icons-material/HealthAndSafety';
import AccountBalanceIcon   from '@mui/icons-material/AccountBalance';
import AssessmentIcon       from '@mui/icons-material/Assessment';
import { useBatchContext } from '../../context/BatchContext';
import { SHEET_SOURCES, SHEET_LABELS } from '../../utils/constants';

const SHEET_ICONS = {
  benefits:        <HealthAndSafetyIcon fontSize="small" />,
  tax:             <AccountBalanceIcon  fontSize="small" />,
  'status-report': <AssessmentIcon      fontSize="small" />,
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
