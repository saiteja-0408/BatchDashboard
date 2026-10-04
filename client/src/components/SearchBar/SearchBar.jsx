/**
 * SearchBar.jsx — global search input with debounce.
 */

import React, { useState, useEffect } from 'react';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useBatchContext } from '../../context/BatchContext';
import { DEBOUNCE_MS } from '../../utils/constants';

export function SearchBar() {
  const { searchQuery, setSearchQuery } = useBatchContext();
  const [localValue, setLocalValue] = useState(searchQuery);

  // Sync local input with context (e.g., when tab changes and search is cleared)
  useEffect(() => { setLocalValue(searchQuery); }, [searchQuery]);

  // Debounce: only push to context after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(localValue), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [localValue, setSearchQuery]);

  return (
    <TextField
      fullWidth
      size="small"
      placeholder="Search by batch name, schedule group, or arguments…"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" color="action" />
          </InputAdornment>
        ),
        endAdornment: localValue ? (
          <InputAdornment position="end">
            <IconButton size="small" onClick={() => { setLocalValue(''); setSearchQuery(''); }}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
    />
  );
}
