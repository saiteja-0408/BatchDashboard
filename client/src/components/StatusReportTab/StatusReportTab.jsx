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
  Box, Typography, Alert, Chip,
  Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Skeleton, CircularProgress,
  TextField, InputAdornment, IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon  from '@mui/icons-material/Clear';
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

/**
 * Column definitions.
 * minWidth keeps the table usable on 1280px.
 * flex (0–1) is a relative weight hint used below to assign proportional widths
 * on large screens where the table has extra horizontal space.
 */
const COLUMNS = [
  { id: 'job_name',         label: 'Job Name',     minWidth: 160, flex: 2   },
  { id: 'job_group',        label: 'Job Group',    minWidth: 140, flex: 1.5 },
  { id: 'start_time',       label: 'Start Time',   minWidth: 90,  flex: 1   },
  { id: 'end_time',         label: 'End Time',     minWidth: 90,  flex: 1   },
  { id: 'next_fire_time',   label: 'Next Fire',    minWidth: 90,  flex: 1   },
  { id: 'biz_error_flag',   label: 'Biz Err',      minWidth: 50,  flex: 0.5 },
  { id: 'error_flag',       label: 'Err',          minWidth: 40,  flex: 0.5 },
  { id: 'killed_flag',      label: 'Killed',       minWidth: 50,  flex: 0.5 },
  { id: 'parent_job_name',  label: 'Parent Job',   minWidth: 140, flex: 1.5 },
  { id: 'parent_job_group', label: 'Parent Group', minWidth: 110, flex: 1   },
  { id: '_status',          label: 'Status',       minWidth: 130, flex: 1   },
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

  const allRows = envelope?.data ?? [];

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

      {/* ── Search input — matches SearchBar.jsx style exactly ── */}
      {showTable && (
        <Box mb={1}>
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

      {/* ── Table (elevation=0 — single border from theme, no shadow stacking) ── */}
      {showTable && (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            width:     '100%',
            overflowX: 'auto',
            // No minHeight — container shrinks to fit actual row count so
            // a filtered 1-row result does not leave a large empty block below it.
            maxHeight: { xs: 'calc(100vh - 340px)', xl: 'calc(100vh - 300px)' },
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
                      // Fluid header font — slightly larger on xl+ for data density
                      fontSize:   { xs: '0.72rem', md: '0.75rem', xl: '0.8rem' },
                      minWidth:   col.minWidth,
                      whiteSpace: { xs: 'normal', md: 'nowrap' },
                      lineHeight: 1.3,
                      py:         { xs: 1, xl: 1.25 },
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
                        // Fluid row font — improves data density on large screens
                        fontSize:   { xs: '0.75rem', md: '0.78rem', xl: '0.83rem' },
                        py:         { xs: 0.75, xl: 1 },
                        // job_name / parent_job_name may be long PascalCase — allow wrap
                        // job_group uses underscore tokens — keep on one line, clip with ellipsis
                        whiteSpace:   col.id === 'job_name' || col.id === 'parent_job_name'
                          ? 'normal'
                          : 'nowrap',
                        wordBreak:    col.id === 'job_name' || col.id === 'parent_job_name'
                          ? 'break-word'
                          : 'normal',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: col.id === 'job_name'
                          ? { xs: 180, md: 220, xl: 320 }
                          : col.id === 'job_group' || col.id === 'parent_job_group'
                            ? { xs: 140, md: 180, xl: 240 }
                            : 'none',
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
