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
  TextField, InputAdornment, IconButton, TableSortLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon  from '@mui/icons-material/Clear';
import { useStatusReport } from '../../hooks/useStatusReport';
import { getRowStatus, sortStatusRows } from '../../utils/helpers';

/** Debounce delay — matches SearchBar.jsx */
const DEBOUNCE_MS = 350;

/**
 * Column definitions.
 * minWidth keeps the table usable on 1280px.
 * flex (0–1) is a relative weight hint used below to assign proportional widths
 * on large screens where the table has extra horizontal space.
 */
const COLUMNS = [
  { id: 'job_name',         label: 'Job Name',     minWidth: 160, flex: 2   },
  { id: 'job_group',        label: 'Job Group',    minWidth: 140, flex: 1.5 },
  { id: 'start_time',       label: 'Start Time',   minWidth: 140, flex: 1.2 },
  { id: 'end_time',         label: 'End Time',     minWidth: 140, flex: 1.2 },
  { id: 'next_fire_time',   label: 'Next Fire',    minWidth: 140, flex: 1.2 },
  { id: 'biz_error_flag',   label: 'Biz Err',      minWidth: 50,  flex: 0.5 },
  { id: 'error_flag',       label: 'Err',          minWidth: 40,  flex: 0.5 },
  { id: 'killed_flag',      label: 'Killed',       minWidth: 50,  flex: 0.5 },
  { id: 'parent_job_name',  label: 'Parent Job',   minWidth: 140, flex: 1.5 },
  { id: 'parent_job_group', label: 'Parent Group', minWidth: 110, flex: 1   },
  { id: '_status',          label: 'Status',       minWidth: 130, flex: 1   },
];

/** Status chip derived from biz_error_flag / row status */
function StatusChip({ row }) {
  const statusStr = getRowStatus(row);
  if (statusStr === 'Biz Error') {
    return (
      <Chip
        label="Biz Error"
        size="small"
        sx={{ bgcolor: 'error.main', color: 'error.contrastText', fontWeight: 700, fontSize: '0.72rem' }}
      />
    );
  }
  if (statusStr === 'OK') {
    return (
      <Chip
        label="OK"
        size="small"
        sx={{ bgcolor: 'success.main', color: 'success.contrastText', fontWeight: 700, fontSize: '0.72rem' }}
      />
    );
  }
  return <Typography variant="caption" color="text.secondary">{statusStr}</Typography>;
}
StatusChip.propTypes = { row: PropTypes.object.isRequired };

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
 * Helper to parse any timestamp / date representation (ISO-8601, DB2 string, Unix timestamp, Date).
 * DB2 formats: "2026-10-03 21:30:00.846000" or "2026-10-03-21.30.00.846000"
 * ISO formats: "2026-10-03T21:30:00.846Z"
 * Unix timestamps: number or numeric string
 * @param {*} v
 * @returns {Date|null}
 */
export function parseDateValue(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    // Check if numeric timestamp
    if (/^\d{10,13}$/.test(s)) {
      const num = Number(s);
      const d = new Date(s.length === 10 ? num * 1000 : num);
      return isNaN(d.getTime()) ? null : d;
    }
    // Normalize DB2 timestamp format "YYYY-MM-DD-HH.mm.ss.ffffff" -> "YYYY-MM-DDTHH:mm:ss"
    const db2Normalized = s.replace(/^(\d{4}-\d{2}-\d{2})[- ](\d{2})[.:](\d{2})[.:](\d{2})(?:\.(\d+))?/, '$1T$2:$3:$4.$5');
    const d1 = new Date(db2Normalized);
    if (!isNaN(d1.getTime())) return d1;

    // Standard Date parse fallback
    const d2 = new Date(s);
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
}

/**
 * Standardize timestamp display to "YYYY-MM-DD HH:mm:ss" (24h) with 2-digit zero-padding.
 * Also provides formatted string for date/time columns.
 * @param {Date} d
 * @returns {string}
 */
export function formatStandardDateTime(d) {
  if (!d || isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year  = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day   = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins  = pad(d.getMinutes());
  const secs  = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}

/**
 * Formats a cell value for display.
 * start_time, end_time, next_fire_time → Standardized Date & Time "YYYY-MM-DD HH:mm:ss".
 * Null/empty → em dash.
 *
 * @param {*}      value  Raw cell value
 * @param {string} colId  Column id (e.g. 'start_time')
 */
export function formatCell(value, colId) {
  if (value === null || value === undefined || value === '') return '—';

  if (colId === 'start_time' || colId === 'end_time' || colId === 'next_fire_time') {
    const d = parseDateValue(value);
    if (d) {
      return formatStandardDateTime(d);
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
  // ── Status sort state: 'default' | 'biz_top' (2-state toggle: sorted <-> normal) ──
  const [statusSortOrder, setStatusSortOrder] = useState('default');

  const handleStatusHeaderClick = () => {
    setStatusSortOrder((prev) => (prev === 'default' ? 'biz_top' : 'default'));
  };

  // Debounce: push to searchQuery 350ms after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset search and sort when the tab is re-entered (enabled transitions false → true)
  // This matches the BatchContext clearSearch() called by SheetTabs on tab switch.
  const prevEnabled = React.useRef(enabled);
  useEffect(() => {
    if (!prevEnabled.current && enabled) {
      setSearchInput('');
      setSearchQuery('');
      setStatusSortOrder('default');
    }
    prevEnabled.current = enabled;
  }, [enabled]);

  const allRows = envelope?.data ?? [];

  // ── Client-side filter & sort (Global multi-column search) ─────────────────
  const filteredRows = useMemo(() => {
    let list = allRows;
    const rawQuery = searchQuery.trim();
    if (rawQuery) {
      const q = rawQuery.toLowerCase();
      list = allRows.filter((row) => {
        if (!row || typeof row !== 'object') return false;

        // 1. Check all direct properties/columns on the row
        for (const [key, val] of Object.entries(row)) {
          if (val === null || val === undefined) continue;

          // Check raw value string
          const rawStr = String(val).toLowerCase();
          if (rawStr.includes(q)) return true;

          // If date/timestamp property, also test standardized formatted display
          if (key.includes('time') || key.includes('date') || val instanceof Date) {
            const d = parseDateValue(val);
            if (d) {
              const formatted = formatStandardDateTime(d).toLowerCase();
              if (formatted.includes(q)) return true;
              const localeStr = d.toLocaleString().toLowerCase();
              if (localeStr.includes(q)) return true;
            }
          }
        }

        // 2. Check derived Status badge string ("Biz Error", "OK", etc.)
        const statusStr = getRowStatus(row);
        if (statusStr && statusStr.toLowerCase().includes(q)) {
          return true;
        }

        // 3. Check for specific Biz Error semantic synonyms
        if (
          q === 'biz error' ||
          q === 'biz' ||
          q === 'business error' ||
          q === 'error'
        ) {
          if (statusStr === 'Biz Error') return true;
        }

        return false;
      });
    }
    return sortStatusRows(list, statusSortOrder);
  }, [allRows, searchQuery, statusSortOrder]);

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
                      cursor:     col.id === '_status' ? 'pointer' : 'default',
                      userSelect: col.id === '_status' ? 'none' : 'auto',
                    }}
                    onClick={col.id === '_status' ? handleStatusHeaderClick : undefined}
                  >
                    {col.id === '_status' ? (
                      <TableSortLabel
                        active={statusSortOrder !== 'default'}
                        direction="asc"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusHeaderClick();
                        }}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : (
                      col.label
                    )}
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
              {!isFetching && filteredRows.map((row, idx) => {
                const isBizError = getRowStatus(row) === 'Biz Error';
                return (
                  <TableRow
                    key={idx}
                    hover
                    className={isBizError ? 'biz-error-row' : ''}
                    sx={{
                      backgroundColor: isBizError ? '#fff3e0 !important' : 'inherit',
                      '&:hover': {
                        backgroundColor: isBizError ? '#ffe0b2 !important' : undefined,
                      },
                    }}
                  >
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
                          ? <StatusChip row={row} />
                          : formatCell(row[col.id], col.id)
                        }
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
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
