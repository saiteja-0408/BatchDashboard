/**
 * FilterPanel.jsx — dropdown filters for frequency and schedule validity,
 * plus active filter chips showing what is currently applied.
 *
 * These filters operate client-side on the already-fetched batch list.
 * Sheet (Benefits/Tax) is handled by the SheetTabs component, not here.
 */

import React from 'react';
import {
  Box, FormControl, InputLabel, Select, MenuItem,
  Chip, Stack, Button, Typography,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useBatchContext } from '../../context/BatchContext';
import { SCHEDULE_FREQUENCY_OPTIONS, COLUMN_LABELS } from '../../utils/constants';

/** Human-readable labels for frequency filter values. */
const FREQUENCY_LABELS = {
  daily:      'Daily',
  weekly:     'Weekly',
  monthly:    'Monthly',
  quarterly:  'Quarterly',
  annual:     'Annual',
  biweekly:   'Bi-weekly',
  on_demand:  'On Demand / Ad-hoc',
};

const FILTER_DEFS = [
  {
    key:     'frequency',
    label:   'Frequency',
    options: SCHEDULE_FREQUENCY_OPTIONS.map((v) => ({ value: v, label: FREQUENCY_LABELS[v] || v })),
  },
  {
    key:     'scheduleValid',
    label:   'Schedule',
    options: [
      { value: 'valid',   label: 'Valid only' },
      { value: 'invalid', label: 'Unknown/invalid only' },
    ],
  },
];

export function FilterPanel() {
  const { filters, updateFilter, clearFilter, clearAllFilters } = useBatchContext();

  const activeFilters = Object.entries(filters).filter(([, v]) => Boolean(v));

  return (
    <Box>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
        <Box display="flex" alignItems="center" gap={0.5}>
          <FilterListIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Filters:
          </Typography>
        </Box>

        {FILTER_DEFS.map(({ key, label, options }) => (
          <FormControl key={key} size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{label}</InputLabel>
            <Select
              label={label}
              value={filters[key] || ''}
              onChange={(e) => updateFilter(key, e.target.value)}
            >
              <MenuItem value=""><em>All</em></MenuItem>
              {options.map(({ value, label: optLabel }) => (
                <MenuItem key={value} value={value}>{optLabel}</MenuItem>
              ))}
            </Select>
          </FormControl>
        ))}

        {activeFilters.length > 0 && (
          <Button size="small" color="secondary" onClick={clearAllFilters} sx={{ whiteSpace: 'nowrap' }}>
            Clear all
          </Button>
        )}
      </Stack>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
          {activeFilters.map(([key, value]) => {
            // Build a human-readable chip label
            const chipLabel = key === 'frequency'
              ? `Frequency: ${FREQUENCY_LABELS[value] || value}`
              : key === 'scheduleValid'
                ? value === 'valid' ? 'Schedule: Valid only' : 'Schedule: Unknown/invalid only'
                : `${COLUMN_LABELS[key] || key}: ${value}`;
            return (
              <Chip
                key={key}
                label={chipLabel}
                size="small"
                onDelete={() => clearFilter(key)}
                color="primary"
                variant="outlined"
              />
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
