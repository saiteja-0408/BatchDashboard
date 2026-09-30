/**
 * StatusReportTab.jsx — renders the "Status Report" tab content.
 *
 * Fully responsive:
 *   - TableContainer fills 100% of its parent width with horizontal scroll
 *     only when the table genuinely cannot fit (no viewport overflow).
 *   - maxHeight uses calc(100vh - offset) so the table fills the screen
 *     on large monitors and still scrolls on small ones.
 *   - Column minWidths are tightened so the total fits a 1280px viewport.
 *   - Timestamps are formatted as short locale strings to save column space.
 *   - Header text wraps (whiteSpace: normal) on very narrow viewports.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Box, Typography, Alert, Chip, CircularProgress, IconButton, Tooltip,
  Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Skeleton, Stack,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useStatusReport } from '../../hooks/useStatusReport';

/** Column definitions — minWidths kept tight so columns fit a 1280px screen */
const COLUMNS = [
  { id: 'job_name',         label: 'Job Name',         minWidth: 160 },
  { id: 'job_group',        label: 'Job Group',         minWidth: 140 },
  { id: 'start_time',       label: 'Start Time',        minWidth: 90  },
  { id: 'end_time',         label: 'End Time',          minWidth: 90  },
  { id: 'next_fire_time',   label: 'Next Fire',         minWidth: 90  },
  { id: 'biz_error_flag',   label: 'Biz Err',           minWidth: 50  },
  { id: 'error_flag',       label: 'Err',               minWidth: 40  },
  { id: 'killed_flag',      label: 'Killed',            minWidth: 50  },
  { id: 'parent_job_name',  label: 'Parent Job',        minWidth: 140 },
  { id: 'parent_job_group', label: 'Parent Group',      minWidth: 110 },
  { id: '_status',          label: 'Status',            minWidth: 130 },
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

  const rows     = envelope?.data     ?? [];
  const cachedAt = envelope?.cachedAt ?? null;
  const cacheHit = envelope?.cacheHit ?? null;

  return (
    /* Prevent this component from ever pushing the page wider than its container */
    <Box sx={{ width: '100%', minWidth: 0 }}>

      {/* ── Toolbar ── */}
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
          {error?.message || 'Failed to load status report. Check the server connection.'}
        </Alert>
      )}

      {/* ── Empty ── */}
      {!isFetching && !isIdle && !isError && rows.length === 0 && envelope && (
        <Alert severity="info" sx={{ fontSize: '0.82rem' }}>
          No status report records found for today.
        </Alert>
      )}

      {/* ── Table ── */}
      {(isFetching || rows.length > 0) && !isIdle && (
        <TableContainer
          component={Paper}
          elevation={1}
          sx={{
            // Fill available width; scroll horizontally only when the table
            // is genuinely wider than the container (never overflow the page).
            width:     '100%',
            overflowX: 'auto',
            // Height: fills remaining viewport minus header + toolbar (~220px)
            maxHeight: 'calc(100vh - 260px)',
            minHeight: 200,
          }}
        >
          <Table
            size="small"
            stickyHeader
            sx={{
              // Let the table shrink/grow with the container;
              // only introduce a horizontal scrollbar when columns
              // genuinely cannot fit any smaller.
              tableLayout: 'auto',
              minWidth:    600,
            }}
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
                      // Allow header text to wrap on narrow viewports
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
              {isFetching && rows.length === 0
                ? <SkeletonRows rows={5} />
                : rows.map((row, idx) => (
                  <TableRow key={idx} hover>
                    {COLUMNS.map((col) => (
                      <TableCell
                        key={col.id}
                        sx={{
                          fontSize:  '0.78rem',
                          py:        0.75,
                          // Allow long job names to wrap rather than blow out the layout
                          whiteSpace: col.id === 'job_name' || col.id === 'job_group' || col.id === 'parent_job_name'
                            ? 'normal'
                            : 'nowrap',
                          wordBreak:  'break-word',
                          maxWidth:   col.id === 'job_name' ? 200 : 'none',
                        }}
                      >
                        {col.id === '_status'
                          ? <StatusChip flag={row.biz_error_flag} />
                          : formatCell(row[col.id])
                        }
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              }
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
