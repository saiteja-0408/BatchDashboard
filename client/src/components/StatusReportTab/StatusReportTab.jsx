/**
 * StatusReportTab.jsx — renders the "Status Report" tab content inside
 * BatchDetailModal.
 *
 * Fetches live data from GET /api/status-report (server caches the DB2 result
 * for 5 minutes). Activated lazily — only starts fetching when the tab is first
 * opened (enabled prop becomes true).
 *
 * Table columns mirror the DB2 result set exactly:
 *   job_name, job_group, start_time, end_time, next_fire_time,
 *   biz_error_flag, error_flag, killed_flag, parent_job_name,
 *   parent_job_group, Status (derived from biz_error_flag)
 *
 * Status column:
 *   biz_error_flag = 'Y' → "Business Error"  (red chip)
 *   biz_error_flag = 'N' → "No Business Error" (green chip)
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

/** Column definitions — order matches the screenshot */
const COLUMNS = [
  { id: 'job_name',         label: 'Job Name',          minWidth: 180 },
  { id: 'job_group',        label: 'Job Group',         minWidth: 120 },
  { id: 'start_time',       label: 'Start Time',        minWidth: 110 },
  { id: 'end_time',         label: 'End Time',          minWidth: 110 },
  { id: 'next_fire_time',   label: 'Next Fire Time',    minWidth: 120 },
  { id: 'biz_error_flag',   label: 'Biz Error Flag',    minWidth: 60  },
  { id: 'error_flag',       label: 'Error Flag',        minWidth: 60  },
  { id: 'killed_flag',      label: 'Killed Flag',       minWidth: 60  },
  { id: 'parent_job_name',  label: 'Parent Job Name',   minWidth: 160 },
  { id: 'parent_job_group', label: 'Parent Job Group',  minWidth: 130 },
  { id: '_status',          label: 'Status',            minWidth: 150 },
];

/**
 * Derives the Status chip from the biz_error_flag value.
 * @param {string} flag — 'Y' | 'N' | any
 */
function StatusChip({ flag }) {
  if (flag === 'Y') {
    return (
      <Chip
        label="Business Error"
        size="small"
        sx={{
          bgcolor:    'error.main',
          color:      'error.contrastText',
          fontWeight: 700,
          fontSize:   '0.72rem',
        }}
      />
    );
  }
  if (flag === 'N') {
    return (
      <Chip
        label="No Business Error"
        size="small"
        sx={{
          bgcolor:    'success.main',
          color:      'success.contrastText',
          fontWeight: 700,
          fontSize:   '0.72rem',
        }}
      />
    );
  }
  return (
    <Typography variant="caption" color="text.secondary">
      {flag ?? '—'}
    </Typography>
  );
}
StatusChip.propTypes = { flag: PropTypes.string };

/** Skeleton placeholder rows shown while a network request is in-flight */
function SkeletonRows({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <TableRow key={i}>
      {COLUMNS.map((col) => (
        <TableCell key={col.id}>
          <Skeleton variant="text" width="80%" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

/**
 * Formats a raw cell value for display.
 * ISO timestamp strings are rendered in locale short format; everything else as-is.
 * @param {*} value
 * @returns {string}
 */
function formatCell(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (value instanceof Date) {
    return value.toLocaleString(undefined, {
      month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
  // ISO string timestamps from mock / DB2 JSON
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    }
  }
  return String(value);
}

/**
 * @param {{ enabled: boolean }} props
 *   enabled — true when this tab is active; triggers the initial data fetch.
 */
export function StatusReportTab({ enabled }) {
  const {
    data:       envelope,
    isFetching,   // true only while a real request is in-flight
    isIdle,       // true when disabled and no data yet (tab not yet opened)
    isError,
    error,
    refetch,
  } = useStatusReport(enabled);

  const rows     = envelope?.data     ?? [];
  const cachedAt = envelope?.cachedAt ?? null;
  const cacheHit = envelope?.cacheHit ?? null;

  return (
    <Box>
      {/* ── Toolbar: last-updated + refresh buttons ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isFetching && <CircularProgress size={14} thickness={5} />}
          {cachedAt && !isFetching && (
            <Typography variant="caption" color="text.secondary">
              Last updated: {new Date(cachedAt).toLocaleTimeString()}
              {cacheHit === true  && ' (cached)'}
              {cacheHit === false && ' (live)'}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Force refresh — bypasses server cache">
            <span>
              <IconButton
                size="small"
                onClick={() => refetch(true)}
                disabled={isFetching}
                aria-label="Force refresh status report"
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Soft refresh (may return cached data within 5 min TTL)">
            <span>
              <IconButton
                size="small"
                onClick={() => refetch(false)}
                disabled={isFetching}
                aria-label="Refresh status report"
                sx={{ color: 'text.secondary' }}
              >
                <RefreshIcon fontSize="small" sx={{ opacity: 0.5 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* ── Idle: tab not yet activated (should never be visible since
               statusReportActivated gates the enabled prop, but kept as
               a safety net) ── */}
      {isIdle && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary" mt={1}>
            Loading status report…
          </Typography>
        </Box>
      )}

      {/* ── Error state ── */}
      {isError && (
        <Alert severity="error" sx={{ mb: 2, fontSize: '0.82rem' }}>
          {error?.message || 'Failed to load status report. Check the server connection.'}
        </Alert>
      )}

      {/* ── Empty state (fetched successfully but zero rows today) ── */}
      {!isFetching && !isIdle && !isError && rows.length === 0 && envelope && (
        <Alert severity="info" sx={{ fontSize: '0.82rem' }}>
          No status report records found for today.
        </Alert>
      )}

      {/* ── Data table: shown during in-flight fetch (skeletons) or when data exists ── */}
      {(isFetching || rows.length > 0) && !isIdle && (
        <TableContainer
          component={Paper}
          elevation={1}
          sx={{ maxHeight: 420, overflowX: 'auto' }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {COLUMNS.map((col) => (
                  <TableCell
                    key={col.id}
                    sx={{
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      minWidth:   col.minWidth,
                      fontSize:   '0.78rem',
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
                      <TableCell key={col.id} sx={{ fontSize: '0.78rem', py: 0.75 }}>
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
  /** Must be true for the hook to begin fetching. Set to true when this tab is active. */
  enabled: PropTypes.bool.isRequired,
};
