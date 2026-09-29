/**
 * FilterPanel.jsx — dropdown filters for domain, frequency, and status,
 * plus active filter chips.
 */

import React from 'react';
import {
  Box, FormControl, InputLabel, Select, MenuItem,
  Chip, Stack, Button, Typography,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useBatchContext } from '../../context/BatchContext';
import { DOMAINS, FREQUENCIES, STATUSES, COLUMN_LABELS } from '../../utils/constants';

const FILTER_DEFS = [
  { key: 'domain',    label: 'Domain',    options: DOMAINS },
  { key: 'frequency', label: 'Frequency', options: FREQUENCIES },
  { key: 'status',    label: 'Status',    options: STATUSES },
];

export function FilterPanel() {
  const { filters, updateFilter, clearFilter, clearAllFilters } = useBatchContext();

  const activeFilters = Object.entries(filters).filter(([, v]) => Boolean(v));

  return (
    <Box>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
        <Box display="flex" alignItems="center" gap={0.5}>
          <FilterListIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">Filters:</Typography>
        </Box>

        {FILTER_DEFS.map(({ key, label, options }) => (
          <FormControl key={key} size="small" sx={{ minWidth: 130 }}>
            <InputLabel>{label}</InputLabel>
            <Select
              label={label}
              value={filters[key]}
              onChange={(e) => updateFilter(key, e.target.value)}
            >
              <MenuItem value=""><em>All</em></MenuItem>
              {options.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>
        ))}

        {activeFilters.length > 0 && (
          <Button size="small" color="secondary" onClick={clearAllFilters}>
            Clear all
          </Button>
        )}
      </Stack>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
          {activeFilters.map(([key, value]) => (
            <Chip
              key={key}
              label={`${COLUMN_LABELS[key] || key}: ${value}`}
              size="small"
              onDelete={() => clearFilter(key)}
              color="primary"
              variant="outlined"
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
