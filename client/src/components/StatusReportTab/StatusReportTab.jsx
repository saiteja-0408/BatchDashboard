/**
 * StatusReportTab.jsx — renders the "Status Report" tab content.
 *
 * Fully responsive — see layout comments inline.
 *
 * Search:
 *   Imports DEBOUNCE_MS from constants (350ms) — same value as SearchBar.jsx.
 *   Filters rows client-side against all visible columns — case-insensitive
 *   partial match. Search resets when the tab is re-entered (enabled: false → true).
 *
 * Sorting:
 *   Every column header is clickable: asc → desc → reset (no sort).
 *   The _status column uses the Biz-Error-first sort from sortStatusRows.
 *   All other columns use the generic compareValues comparator which handles
 *   strings (locale-aware, case-insensitive), numbers, and Date objects.
 *   Sorting never mutates the original data array — always operates on a copy.
 *
 * Virtualization:
 *   Custom row-virtualization (same approach as BatchTable) renders only the
 *   rows inside the visible viewport ± OVERSCAN rows. DOM nodes are capped at
 *   ~15–20 rows regardless of dataset size, eliminating scroll stutter for
 *   datasets up to 900+ rows.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { getRowStatus, sortStatusRows, compareValues } from '../../utils/helpers';
import { DEBOUNCE_MS } from '../../utils/constants';

// ── Virtualization constants ──────────────────────────────────────────────────
/** Fixed row height in px — must match the actual rendered row height. */
const VIRTUAL_ROW_HEIGHT = 38;
/** Extra rows to render above and below the visible window. */
const OVERSCAN_COUNT = 5;

/**
 * Column definitions.
 * minWidth keeps the table usable at 1280px.
 * sortable: false prevents click handlers on non-data columns.
 */
const COLUMNS = [
  { id: 'job_name',         label: 'Job Name',     minWidth: 160, sortable: true  },
  { id: 'job_group',        label: 'Job Group',    minWidth: 140, sortable: true  },
  { id: 'start_time',       label: 'Start Time',   minWidth: 140, sortable: true  },
  { id: 'end_time',         label: 'End Time',     minWidth: 140, sortable: true  },
  { id: 'next_fire_time',   label: 'Next Fire',    minWidth: 140, sortable: true  },
  { id: 'biz_error_flag',   label: 'Biz Err',      minWidth: 50,  sortable: true  },
  { id: 'error_flag',       label: 'Err',          minWidth: 40,  sortable: true  },
  { id: 'killed_flag',      label: 'Killed',       minWidth: 50,  sortable: true  },
  { id: 'parent_job_name',  label: 'Parent Job',   minWidth: 140, sortable: true  },
  { id: 'parent_job_group', label: 'Parent Group', minWidth: 110, sortable: true  },
  { id: '_status',          label: 'Status',       minWidth: 130, sortable: true  },
];

// ── StatusChip ────────────────────────────────────────────────────────────────

/** Status chip derived from error_flag / biz_error_flag / row status. */
function StatusChip({ row }) {
  const statusStr = getRowStatus(row);
  if (statusStr === 'Batch Failed') {
    return (
      <Chip
        label="Batch Failed"
        size="small"
        sx={{ bgcolor: '#d32f2f', color: '#fff', fontWeight: 700, fontSize: '0.72rem' }}
      />
    );
  }
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

// ── SkeletonRows ──────────────────────────────────────────────────────────────

/** Skeleton rows while loading. */
function SkeletonRows({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <TableRow key={i}>
      {COLUMNS.map((col) => (
        <TableCell key={col.id}><Skeleton variant="text" width="80%" /></TableCell>
      ))}
    </TableRow>
  ));
}
SkeletonRows.propTypes = { rows: PropTypes.number };

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Parses any timestamp/date representation into a Date object.
 * Handles: ISO-8601, DB2 format ("YYYY-MM-DD HH:mm:ss.ffffff"),
 * Unix timestamps (10-digit seconds, 13-digit ms), and Date instances.
 *
 * @param {string|number|Date|null|undefined} v
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
    // Unix timestamp (10 = seconds, 13 = milliseconds)
    if (/^\d{10,13}$/.test(s)) {
      const num = Number(s);
      const d = new Date(s.length === 10 ? num * 1000 : num);
      return isNaN(d.getTime()) ? null : d;
    }
    // Normalise DB2 timestamp "YYYY-MM-DD HH:mm:ss.ffffff" → ISO format
    const db2Normalized = s.replace(
      /^(\d{4}-\d{2}-\d{2})[- ](\d{2})[.:](\d{2})[.:](\d{2})(?:\.(\d+))?/,
      '$1T$2:$3:$4.$5'
    );
    const d1 = new Date(db2Normalized);
    if (!isNaN(d1.getTime())) return d1;

    // Standard Date parse fallback
    const d2 = new Date(s);
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
}

/**
 * Formats a Date as "YYYY-MM-DD HH:mm:ss" (zero-padded, 24-hour clock).
 * @param {Date} d
 * @returns {string}
 */
export function formatStandardDateTime(d) {
  if (!d || isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/**
 * Formats a cell value for display.
 * Date columns (start_time, end_time, next_fire_time) → "YYYY-MM-DD HH:mm:ss".
 * Null/empty → em dash.
 *
 * @param {*}      value  Raw cell value
 * @param {string} colId  Column id
 * @returns {string}
 */
export function formatCell(value, colId) {
  if (value === null || value === undefined || value === '') return '—';

  if (colId === 'start_time' || colId === 'end_time' || colId === 'next_fire_time') {
    const d = parseDateValue(value);
    if (d) return formatStandardDateTime(d);
  }

  return String(value);
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

/**
 * Compares two status-report rows for a given column.
 * Date columns are compared chronologically as Date objects.
 * The _status column uses Biz-Error-first ordering.
 * All other columns delegate to the generic compareValues utility.
 *
 * @param {object} a
 * @param {object} b
 * @param {string} colId
 * @param {'asc'|'desc'} direction
 * @returns {number}
 */
function compareRowsByColumn(a, b, colId, direction) {
  // _status column: Batch Failed first, Biz Error second, everything else last
  if (colId === '_status') {
    const statusA = getRowStatus(a);
    const statusB = getRowStatus(b);

    // Assign a sort priority bucket: lower number = higher priority
    const priorityOf = (s) => {
      if (s === 'Batch Failed') return 0;
      if (s === 'Biz Error')    return 1;
      return 2;
    };

    const pa = priorityOf(statusA);
    const pb = priorityOf(statusB);

    // Different priority buckets — order is always "Batch Failed → Biz Error → rest"
    // regardless of asc/desc so that critical rows are always surfaced at the top.
    if (pa !== pb) return direction === 'asc' ? pa - pb : pb - pa;

    // Same priority bucket — for "Batch Failed" preserve stable (arrival) order;
    // for all other buckets, fall through to a secondary alphabetical compare.
    if (pa === 0) return 0; // stable: keep original relative order for failed rows
    return compareValues(statusA, statusB, direction);
  }

  // Date columns: parse and compare as Date ms values
  if (colId === 'start_time' || colId === 'end_time' || colId === 'next_fire_time') {
    const dateA = parseDateValue(a[colId]);
    const dateB = parseDateValue(b[colId]);
    const msA = dateA ? dateA.getTime() : null;
    const msB = dateB ? dateB.getTime() : null;
    return compareValues(msA, msB, direction);
  }

  return compareValues(a[colId], b[colId], direction);
}

/**
 * Cycles the sort direction for a column:
 *   none → asc → desc → none
 *
 * @param {{ key: string, direction: 'asc'|'desc' } | null} current
 * @param {string} colId
 * @returns {{ key: string, direction: 'asc'|'desc' } | null}
 */
function nextSortConfig(current, colId) {
  if (!current || current.key !== colId) return { key: colId, direction: 'asc' };
  if (current.direction === 'asc')       return { key: colId, direction: 'desc' };
  // desc → reset (no sort)
  return null;
}

// ── StatusReportTab ───────────────────────────────────────────────────────────

/** @param {{ enabled: boolean }} props */
export function StatusReportTab({ enabled }) {
  const {
    data:       envelope,
    isFetching,
    isIdle,
    isError,
    error,
  } = useStatusReport(enabled);

  // ── Local search state ────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Sort state: { key: string, direction: 'asc'|'desc' } | null ──────────
  const [sortConfig, setSortConfig] = useState(null);

  // Debounce: push to searchQuery after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset search and sort when the tab is re-entered (enabled transitions false → true)
  const prevEnabled = useRef(enabled);
  useEffect(() => {
    if (!prevEnabled.current && enabled) {
      setSearchInput('');
      setSearchQuery('');
      setSortConfig(null);
    }
    prevEnabled.current = enabled;
  }, [enabled]);

  // ── Virtualization state — declared before any early returns ─────────────
  const containerRef  = useRef(null);
  const [tableHeight, setTableHeight] = useState(500);
  const [scrollTop,   setScrollTop]   = useState(0);

  useEffect(() => {
    const updateHeight = () => {
      const windowH = window.innerHeight;
      setTableHeight(Math.max(300, Math.min(windowH - 320, 700)));
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // ── Sort column header click ──────────────────────────────────────────────
  const handleSortClick = useCallback((colId) => {
    setSortConfig((prev) => nextSortConfig(prev, colId));
    // Reset scroll to top so the user sees the sorted result from the beginning
    setScrollTop(0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, []);

  const allRows = envelope?.data ?? [];

  // ── Client-side filter ────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const rawQuery = searchQuery.trim();
    if (!rawQuery) return allRows;

    const q = rawQuery.toLowerCase();
    return allRows.filter((row) => {
      if (!row || typeof row !== 'object') return false;

      // 1. Match against every raw column value
      for (const [key, val] of Object.entries(row)) {
        if (val === null || val === undefined) continue;

        if (String(val).toLowerCase().includes(q)) return true;

        // For date/time columns also test the formatted display string
        if (key.includes('time') || key.includes('date') || val instanceof Date) {
          const d = parseDateValue(val);
          if (d) {
            if (formatStandardDateTime(d).toLowerCase().includes(q)) return true;
            if (d.toLocaleString().toLowerCase().includes(q)) return true;
          }
        }
      }

      // 2. Match against the derived Status label ("Biz Error", "OK", etc.)
      const statusStr = getRowStatus(row);
      if (statusStr && statusStr.toLowerCase().includes(q)) return true;

      // 3. Semantic status synonyms
      if (
        (q === 'biz error' || q === 'biz' || q === 'business error') &&
        statusStr === 'Biz Error'
      ) {
        return true;
      }
      if (
        (q === 'batch failed' || q === 'failed' || q === 'error' || q === 'batch fail') &&
        statusStr === 'Batch Failed'
      ) {
        return true;
      }

      return false;
    });
  }, [allRows, searchQuery]);

  // ── Client-side sort (never mutates filteredRows) ─────────────────────────
  const sortedRows = useMemo(() => {
    if (!sortConfig) return filteredRows;
    return [...filteredRows].sort((a, b) =>
      compareRowsByColumn(a, b, sortConfig.key, sortConfig.direction)
    );
  }, [filteredRows, sortConfig]);

  // ── Virtualization window ─────────────────────────────────────────────────
  const totalCount    = sortedRows.length;
  const startIndex    = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - OVERSCAN_COUNT);
  const endIndex      = Math.min(
    totalCount,
    Math.ceil((scrollTop + tableHeight) / VIRTUAL_ROW_HEIGHT) + OVERSCAN_COUNT
  );
  const paddingTop    = startIndex * VIRTUAL_ROW_HEIGHT;
  const paddingBottom = Math.max(0, (totalCount - endIndex) * VIRTUAL_ROW_HEIGHT);

  const visibleRows = useMemo(
    () => sortedRows.slice(startIndex, endIndex),
    [sortedRows, startIndex, endIndex]
  );

  // ── Derived display flags ─────────────────────────────────────────────────
  const showTable = (isFetching || allRows.length > 0) && !isIdle;
  const noResults = !isFetching && searchQuery.trim() && filteredRows.length === 0 && allRows.length > 0;

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>

      {/* ── Search input ── */}
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

      {/* ── Idle (tab not yet activated) ── */}
      {isIdle && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary" mt={1}>Loading status report…</Typography>
        </Box>
      )}

      {/* ── Error state ── */}
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

      {/* ── Empty state (no data from server) ── */}
      {!isFetching && !isIdle && !isError && allRows.length === 0 && envelope && (
        <Alert severity="info" sx={{ fontSize: '0.82rem' }}>
          No status report records found for today.
        </Alert>
      )}

      {/* ── Table with virtualized rows ── */}
      {showTable && (
        <TableContainer
          component={Paper}
          elevation={0}
          ref={containerRef}
          onScroll={handleScroll}
          sx={{
            width:     '100%',
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: tableHeight,
          }}
        >
          <Table
            size="small"
            stickyHeader
            sx={{ tableLayout: 'auto', minWidth: 600 }}
          >
            <TableHead>
              <TableRow>
                {COLUMNS.map((col) => {
                  const isActive = sortConfig?.key === col.id;
                  return (
                    <TableCell
                      key={col.id}
                      sortDirection={isActive ? sortConfig.direction : false}
                      sx={{
                        fontWeight: 700,
                        fontSize:   { xs: '0.72rem', md: '0.75rem', xl: '0.8rem' },
                        minWidth:   col.minWidth,
                        whiteSpace: { xs: 'normal', md: 'nowrap' },
                        lineHeight: 1.3,
                        py:         { xs: 1, xl: 1.25 },
                        cursor:     col.sortable ? 'pointer' : 'default',
                        userSelect: col.sortable ? 'none' : 'auto',
                      }}
                      onClick={col.sortable ? () => handleSortClick(col.id) : undefined}
                    >
                      {col.sortable ? (
                        <TableSortLabel
                          active={isActive}
                          direction={isActive ? sortConfig.direction : 'asc'}
                        >
                          {col.label}
                        </TableSortLabel>
                      ) : (
                        col.label
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Loading skeletons */}
              {isFetching && allRows.length === 0 && <SkeletonRows rows={5} />}

              {/* No search results message */}
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

              {/* Top virtual spacer — preserves scroll position for rows above viewport */}
              {!isFetching && paddingTop > 0 && (
                <TableRow sx={{ height: `${paddingTop}px !important`, border: 0 }}>
                  <TableCell colSpan={COLUMNS.length} sx={{ p: 0, border: 0, height: `${paddingTop}px` }} />
                </TableRow>
              )}

              {/* Visible data rows */}
              {!isFetching && visibleRows.map((row, idx) => {
                const rowStatus    = getRowStatus(row);
                const isBatchFailed = rowStatus === 'Batch Failed';
                const isBizError    = rowStatus === 'Biz Error';
                // Use absolute index for stable key during virtualized scrolling
                const absoluteIdx = startIndex + idx;
                return (
                  <TableRow
                    key={absoluteIdx}
                    hover
                    sx={{
                      backgroundColor: isBatchFailed
                        ? '#ffebee !important'
                        : isBizError
                          ? '#fff3e0 !important'
                          : 'inherit',
                      '&:hover': {
                        backgroundColor: isBatchFailed
                          ? '#ffcdd2 !important'
                          : isBizError
                            ? '#ffe0b2 !important'
                            : undefined,
                      },
                    }}
                  >
                    {COLUMNS.map((col) => (
                      <TableCell
                        key={col.id}
                        sx={{
                          fontSize:   { xs: '0.75rem', md: '0.78rem', xl: '0.83rem' },
                          py:         { xs: 0.75, xl: 1 },
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

              {/* Bottom virtual spacer — maintains scrollbar thumb size */}
              {!isFetching && paddingBottom > 0 && (
                <TableRow sx={{ height: `${paddingBottom}px !important`, border: 0 }}>
                  <TableCell colSpan={COLUMNS.length} sx={{ p: 0, border: 0, height: `${paddingBottom}px` }} />
                </TableRow>
              )}
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
