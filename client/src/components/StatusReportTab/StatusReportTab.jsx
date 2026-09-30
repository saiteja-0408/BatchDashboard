/**
 * StatusReportTab.jsx — renders the "Status Report" tab content.
 *
 * Fully responsive — see layout comments inline.
 *
 * Search:
 *   Local useState + 350ms debounce (same pattern as SearchBar.jsx).
 *   Filters rows client-side against job_name, job_group, biz_error_flag,
 *   error_flag, killed_flag, parent_job_name, parent_job_group — case-insensitive
 *   partial match. Search resets when the tab is re-entered (enabled: false → true).
 */

import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Box, Typography, Alert, Chip, CircularProgress, IconButton, Tooltip,
  Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Skeleton, Stack,
  TextField, InputAdornment,
} from '@mui/material';
import RefreshIcon    from '@mui/icons-material/Refresh';
import SearchIcon     from '@mui/icons-material/Search';
import ClearIcon      from '@mui/icons-material/Clear';
import { useStatusReport } from '../../hooks/useStatusReport';

/** Debounce delay — matches SearchBar.jsx */
const DEBOUNCE_MS = 350;

/**
 * Column IDs that are searched.
 * Excludes timestamp columns (start_time, end_time, next_fire_time) because
 * formatted timestamps are locale-specific and not useful to search.
 */
const SEARCHABLE_IDS = new Set([
  'job_name', 'job_group',
  'biz_error_flag', 'error_flag', 'killed_flag',
  'parent_job_name', 'parent_job_group',
]);

/** Column definitions — minWidths kept tight so total fits a 1280px screen */
const COLUMNS = [
  { id: 'job_name',         label: 'Job Name',     minWidth: 160 },
  { id: 'job_group',        label: 'Job Group',    minWidth: 140 },
  { id: 'start_time',       label: 'Start Time',   minWidth: 90  },
  { id: 'end_time',         label: 'End Time',     minWidth: 90  },
  { id: 'next_fire_time',   label: 'Next Fire',    minWidth: 90  },
  { id: 'biz_error_flag',   label: 'Biz Err',      minWidth: 50  },
  { id: 'error_flag',       label: 'Err',          minWidth: 40  },
  { id: 'killed_flag',      label: 'Killed',       minWidth: 50  },
  { id: 'parent_job_name',  label: 'Parent Job',   minWidth: 140 },
  { id: 'parent_job_group', label: 'Parent Group', minWidth: 110 },
  { id: '_status',          label: 'Status',       minWidth: 130 },
];

/** Status chip derived from biz_error_flag */
function StatusChip({ flag }) {
  if (flag === 'Y') {
    return (
      <Chip
        label="Biz Error"
        size="small"
        sx={{ bgcolor: 'error.main', color: 'error.contrastText', fontWeight: 700, fontSize: '0.72rem' }}
      />
    );
  }
  if (flag === 'N') {
    return (
      <Chip
        label="OK"
        size="small"
        sx={{ bgcolor: 'success.main', color: 'success.contrastText', fontWeight: 700, fontSize: '0.72rem' }}
      />
    );
  }
  return <Typography variant="caption" color="text.secondary">{flag ?? '—'}</Typography>;
}
StatusChip.propTypes = { flag: PropTypes.string };

/** Skeleton rows while loading */
function SkeletonRows({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <TableRow key={i}>
      {COLUMNS.map((col) => (
        <TableCell key={col.id}><Skeleton variant="text" width="80%" /></TableCell>
      ))}
    </TableRow>
  ));
}

/**
 * Formats a cell value for display.
 * Timestamps → locale short date+time. Null/empty → em dash.
 */
function formatCell(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (value instanceof Date) {
    return value.toLocaleString(undefined, {
      month: '2-digit', day: '2-digit',
      hour:  '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        month: '2-digit', day: '2-digit',
        hour:  '2-digit', minute: '2-digit', second: '2-digit',
      });
    }
  }
  return String(value);
}

/** @param {{ enabled: boolean }} props */
export function StatusReportTab({ enabled }) {
  const {
    data:       envelope,
    isFetching,
    isIdle,
    isError,
    error,
    refetch,
  } = useStatusReport(enabled);

  // ── Local search state (same pattern as SearchBar.jsx) ────────────────────
  const [searchInput, setSearchInput]   = useState('');
  const [searchQuery, setSearchQuery]   = useState('');

  // Debounce: push to searchQuery 350ms after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset search when the tab is re-entered (enabled transitions false → true)
  // This matches the BatchContext clearSearch() called by SheetTabs on tab switch.
  const prevEnabled = React.useRef(enabled);
  useEffect(() => {
    if (!prevEnabled.current && enabled) {
      setSearchInput('');
      setSearchQuery('');
    }
    prevEnabled.current = enabled;
  }, [enabled]);

  const allRows  = envelope?.data     ?? [];
  const cachedAt = envelope?.cachedAt ?? null;
  const cacheHit = envelope?.cacheHit ?? null;

  // ── Client-side filter ────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return allRows;
    const q = searchQuery.toLowerCase();
    return allRows.filter((row) =>
      COLUMNS.some((col) => {
        if (!SEARCHABLE_IDS.has(col.id)) return false;
        const val = row[col.id];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      })
    );
  }, [allRows, searchQuery]);

  const showTable  = (isFetching || allRows.length > 0) && !isIdle;
  const noResults  = !isFetching && searchQuery.trim() && filteredRows.length === 0 && allRows.length > 0;

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>

      {/* ── Toolbar: cache info + refresh buttons ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          {isFetching && <CircularProgress size={14} thickness={5} />}
          {cachedAt && !isFetching && (
            <Typography variant="caption" color="text.secondary" noWrap>
              Last updated: {new Date(cachedAt).toLocaleTimeString()}
              {cacheHit === true  && ' (cached)'}
              {cacheHit === false && ' (live)'}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0}>
          <Tooltip title="Force refresh — bypasses server cache">
            <span>
              <IconButton size="small" onClick={() => refetch(true)} disabled={isFetching} aria-label="Force refresh">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Soft refresh (may return cached data)">
            <span>
              <IconButton size="small" onClick={() => refetch(false)} disabled={isFetching} aria-label="Refresh" sx={{ color: 'text.secondary' }}>
                <RefreshIcon fontSize="small" sx={{ opacity: 0.5 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* ── Search input — matches SearchBar.jsx style exactly ── */}
      {showTable && (
        <Box mb={1.5}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by job name, job group, status…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: searchInput ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                    aria-label="Clear search"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        </Box>
      )}

      {/* ── Idle ── */}
      {isIdle && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary" mt={1}>Loading status report…</Typography>
        </Box>
      )}

      {/* ── Error ── */}
      {isError && (
        <Alert severity="error" sx={{ mb: 2, fontSize: '0.82rem' }}>
          {(() => {
            const msg = error?.message || '';
            if (msg.includes('Cannot reach DB2') || msg.includes('SQLSTATE=08001') || msg.includes('SQL30081N')) {
              return (
                <>
                  <strong>DB2 server unreachable.</strong> The server could not connect to the DB2
                  database. This is usually a network or firewall issue — the DB2 host is not
                  accessible from this machine.
                  <br />
                  <span style={{ opacity: 0.75 }}>{msg}</span>
                </>
              );
            }
            if (msg.includes('timeout') || msg.includes('Timeout')) {
              return (
                <>
                  <strong>Request timed out.</strong> The Status Report query is taking too long.
                  Try again — if it keeps failing, check that the DB2 server is responding.
                </>
              );
            }
            return msg || 'Failed to load status report. Check the server connection.';
          })()}
        </Alert>
      )}

      {/* ── Empty (no data from server today) ── */}
      {!isFetching && !isIdle && !isError && allRows.length === 0 && envelope && (
        <Alert severity="info" sx={{ fontSize: '0.82rem' }}>
          No status report records found for today.
        </Alert>
      )}

      {/* ── Table ── */}
      {showTable && (
        <TableContainer
          component={Paper}
          elevation={1}
          sx={{
            width:     '100%',
            overflowX: 'auto',
            maxHeight: 'calc(100vh - 310px)',   // +50px to account for search field
            minHeight: 200,
          }}
        >
          <Table
            size="small"
            stickyHeader
            sx={{ tableLayout: 'auto', minWidth: 600 }}
          >
            <TableHead>
              <TableRow>
                {COLUMNS.map((col) => (
                  <TableCell
                    key={col.id}
                    sx={{
                      fontWeight: 700,
                      fontSize:   '0.75rem',
                      minWidth:   col.minWidth,
                      whiteSpace: { xs: 'normal', md: 'nowrap' },
                      lineHeight: 1.3,
                      py: 1,
                    }}
                  >
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Loading skeletons */}
              {isFetching && allRows.length === 0 && <SkeletonRows rows={5} />}

              {/* No search results */}
              {noResults && (
                <TableRow>
                  <TableCell
                    colSpan={COLUMNS.length}
                    sx={{ textAlign: 'center', py: 4, color: 'text.secondary', fontSize: '0.85rem' }}
                  >
                    No results found for &ldquo;{searchQuery}&rdquo;
                  </TableCell>
                </TableRow>
              )}

              {/* Data rows */}
              {!isFetching && filteredRows.map((row, idx) => (
                <TableRow key={idx} hover>
                  {COLUMNS.map((col) => (
                    <TableCell
                      key={col.id}
                      sx={{
                        fontSize:   '0.78rem',
                        py:         0.75,
                        whiteSpace: col.id === 'job_name' || col.id === 'job_group' || col.id === 'parent_job_name'
                          ? 'normal'
                          : 'nowrap',
                        wordBreak: 'break-word',
                        maxWidth:  col.id === 'job_name' ? 200 : 'none',
                      }}
                    >
                      {col.id === '_status'
                        ? <StatusChip flag={row.biz_error_flag} />
                        : formatCell(row[col.id])
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

StatusReportTab.propTypes = {
  enabled: PropTypes.bool.isRequired,
};
