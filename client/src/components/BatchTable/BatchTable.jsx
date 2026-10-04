/**
 * BatchTable.jsx — sortable, clickable batch data table.
 *
 * Columns: [warn] Batch Name | Schedule Name | Arguments
 *
 * The "Sheet" column has been removed — the active tab already indicates
 * which sheet is displayed.
 *
 * Current Task column is hidden but fully preserved. To re-enable it, flip:
 *   const SHOW_CURRENT_TASK = true;
 *
 * On mobile (<600px) renders a card list.
 * Rows support keyboard navigation (Enter key opens detail modal).
 *
 * Performance optimizations:
 *   - BatchCard is React.memo'd — only re-renders when its own props change.
 *   - BatchRow is React.memo'd — large lists (800+ rows) avoid full re-renders
 *     on every 60s current-tasks poll by only updating rows whose currentTask changed.
 *   - currentTaskMap is memoised.
 *   - sortedData is memoised inside useSort.
 *   - openBatchModal is stable useCallback from context.
 */

import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, Paper, Typography, Box, Chip, Card, CardContent,
  CardActionArea, Skeleton, Stack, Tooltip, useMediaQuery, useTheme,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useBatchContext }    from '../../context/BatchContext';
import { useSort }            from '../../hooks/useSort';
import { useCurrentTasks }    from '../../hooks/useBatches';
import { CurrentTaskBadge }   from '../CurrentTaskBadge/CurrentTaskBadge';
import { SORTABLE_COLUMNS, VALID_SCHEDULE_NAMES } from '../../utils/constants';

/**
 * Feature flag — flip to `true` to restore the Current Task column.
 * When false: no API polling, no column header, no cell rendering.
 */
const SHOW_CURRENT_TASK = false;

/**
 * Small chip that shows Y (green) or N (red) for Trigger Needed.
 * Empty/unknown values render an em-dash.
 */
function TriggerBadge({ value }) {
  if (value === 'Y') {
    return (
      <Chip
        label="Y"
        size="small"
        sx={{ bgcolor: 'success.main', color: 'success.contrastText', fontWeight: 700, fontSize: '0.72rem', height: 20 }}
      />
    );
  }
  if (value === 'N') {
    return (
      <Chip
        label="N"
        size="small"
        sx={{ bgcolor: 'error.main', color: 'error.contrastText', fontWeight: 700, fontSize: '0.72rem', height: 20 }}
      />
    );
  }
  return <Typography variant="caption" color="text.secondary">—</Typography>;
}

/** Loading skeleton rows */
function SkeletonRows({ count = 8 }) {
  return Array.from({ length: count }).map((_, i) => (
    <TableRow key={i}>
      <TableCell />
      {SORTABLE_COLUMNS.map((col) => (
        <TableCell key={col.id}>
          <Skeleton variant="text" width="80%" />
        </TableCell>
      ))}
      {SHOW_CURRENT_TASK && (
        <TableCell><Skeleton variant="rounded" width={80} height={22} /></TableCell>
      )}
    </TableRow>
  ));
}
SkeletonRows.propTypes = { count: PropTypes.number };

/**
 * Mobile card for a single batch.
 * Memoised so the entire card list does not re-render when currentTaskMap
 * updates for an unrelated batch.
 */
const BatchCard = React.memo(function BatchCard({ batch, currentTask, onClick }) {
  const isValid = VALID_SCHEDULE_NAMES.has(batch.scheduleName);
  return (
    <Card elevation={1} sx={{ mb: 1, borderLeft: isValid ? undefined : '3px solid #ed6c02' }}>
      <CardActionArea onClick={() => onClick(batch)}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="subtitle2" fontWeight={700} sx={{ wordBreak: 'break-word', flex: 1, mr: 1 }}>
              {batch.batchName}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {!isValid && (
                <Tooltip title="Unknown schedule name">
                  <WarningAmberIcon fontSize="small" color="warning" />
                </Tooltip>
              )}
              {SHOW_CURRENT_TASK && currentTask && (
                <CurrentTaskBadge currentTask={currentTask} isLoading={false} />
              )}
            </Stack>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block">
            {batch.scheduleName || '—'}
          </Typography>
          {batch.triggerNeeded && (
            <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
              <Typography variant="caption" color="text.secondary">Trigger:</Typography>
              <TriggerBadge value={batch.triggerNeeded} />
            </Stack>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
});
BatchCard.propTypes = {
  batch:       PropTypes.object.isRequired,
  currentTask: PropTypes.object,
  onClick:     PropTypes.func.isRequired,
};

// ── Static sx variants hoisted outside BatchRow ───────────────────────────────
// Defining these outside the component means Emotion generates the CSS class
// exactly once at module load time instead of on every render of every row.
// With 800+ rows and a re-render cycle on each 60s poll, this eliminates
// 800+ repeated Emotion hash lookups per cycle.
const ROW_SX_VALID = {
  cursor: 'pointer',
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
};
const ROW_SX_INVALID = {
  cursor: 'pointer',
  borderLeft: '3px solid #ed6c02',
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
};

/**
 * Single desktop table row — memoised so only the rows whose currentTask
 * actually changed re-render during the 60s poll cycle.
 */
const BatchRow = React.memo(function BatchRow({ batch, currentTask, ctLoading, onClick }) {
  const isValid = VALID_SCHEDULE_NAMES.has(batch.scheduleName);

  const handleClick = useCallback(() => onClick(batch), [batch, onClick]);
  const handleKeyDown = useCallback(
    (e) => { if (e.key === 'Enter') onClick(batch); },
    [batch, onClick]
  );
  const stopPropagation = useCallback((e) => e.stopPropagation(), []);

  return (
    <TableRow
      hover
      tabIndex={0}
      sx={isValid ? ROW_SX_VALID : ROW_SX_INVALID}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Warning icon cell */}
      <TableCell sx={{ px: 1, width: 28, minWidth: 28 }}>
        {!isValid && (
          <Tooltip title={`Unknown schedule: "${batch.scheduleName}"`}>
            <WarningAmberIcon fontSize="small" color="warning" />
          </Tooltip>
        )}
      </TableCell>
      <TableCell sx={{ fontWeight: 500, minWidth: 160 }}>{batch.batchName}</TableCell>
      <TableCell sx={{ fontFamily: 'monospace', fontSize: 'clamp(0.72rem, 0.85vw, 0.85rem)', minWidth: 140 }}>
        {batch.scheduleName || (
          <Typography variant="caption" color="error">missing</Typography>
        )}
      </TableCell>
      <TableCell
        sx={{ maxWidth: { xs: 140, sm: 200, md: 260, xl: 340 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        <Tooltip title={batch.arguments || ''} placement="top">
          <span>
            {batch.arguments || (
              <Typography component="span" variant="caption" color="text.secondary">—</Typography>
            )}
          </span>
        </Tooltip>
      </TableCell>
      {/* Trigger Needed cell */}
      <TableCell sx={{ minWidth: 90 }}>
        <TriggerBadge value={batch.triggerNeeded} />
      </TableCell>
      {/* Current Task cell — hidden when SHOW_CURRENT_TASK is false */}
      {SHOW_CURRENT_TASK && (
        <TableCell onClick={stopPropagation} sx={{ py: 0.5 }}>
          <CurrentTaskBadge
            currentTask={currentTask}
            isLoading={ctLoading && !currentTask}
          />
        </TableCell>
      )}
    </TableRow>
  );
});
BatchRow.propTypes = {
  batch:       PropTypes.object.isRequired,
  currentTask: PropTypes.object,
  ctLoading:   PropTypes.bool,
  onClick:     PropTypes.func.isRequired,
};

/**
 * @param {{ batches: Object[], isLoading: boolean, isError: boolean }} props
 */
export function BatchTable({ batches, isLoading, isError }) {
  const { openBatchModal, activeSheet } = useBatchContext();
  const { sortedData, sortConfig, requestSort } = useSort(batches);
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Current-task polling — only active when SHOW_CURRENT_TASK is enabled.
  // When disabled the hook returns immediately with no data and no API call.
  const {
    data:      currentTasksEnvelope,
    isLoading: ctLoading,
  } = useCurrentTasks(SHOW_CURRENT_TASK ? activeSheet : null, SHOW_CURRENT_TASK);

  // Build a batchName → currentTask lookup map for O(1) cell rendering.
  // Returns an empty object when SHOW_CURRENT_TASK is false.
  const currentTaskMap = useMemo(() => {
    if (!SHOW_CURRENT_TASK || !currentTasksEnvelope?.data) return {};
    return Object.fromEntries(
      currentTasksEnvelope.data.map((r) => [r.batchName, r.currentTask])
    );
  }, [currentTasksEnvelope]);

  if (isError) {
    return (
      <Box p={4} textAlign="center">
        <Typography color="error">
          Failed to load batch data. Check that the server is running and the Excel file is present.
        </Typography>
      </Box>
    );
  }

  if (!isLoading && (!sortedData || sortedData.length === 0)) {
    return (
      <Box p={4} textAlign="center">
        <Typography color="text.secondary">
          No batches found. Check that benefits.xlsx and tax.xlsx are present in the data directory and restart the server.
        </Typography>
      </Box>
    );
  }

  // ── Mobile card layout ────────────────────────────────────────────────────
  if (isMobile) {
    if (isLoading) return <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />;
    return (
      <Box>
        {sortedData.map((b) => (
          <BatchCard
            key={b.batchName}
            batch={b}
            currentTask={SHOW_CURRENT_TASK ? currentTaskMap[b.batchName] : undefined}
            onClick={openBatchModal}
          />
        ))}
      </Box>
    );
  }

  // ── Desktop table layout ──────────────────────────────────────────────────
  return (
    // elevation={0} — theme provides a single 1px border; avoids a drop-shadow
    // stacking on top of the SearchBar visual separation above.
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        overflowX: 'auto',
        width:     '100%',
        maxHeight: { xs: 'none', md: 'calc(100vh - 320px)', xl: 'calc(100vh - 280px)' },
      }}
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {/* Warning indicator column — no sort */}
            <TableCell sx={{ width: 28, minWidth: 28 }} />
            {SORTABLE_COLUMNS.map((col) => (
              <TableCell
                key={col.id}
                sx={{
                  whiteSpace: 'nowrap',
                  fontWeight: 700,
                  fontSize: { md: '0.8rem', xl: '0.875rem' },
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => requestSort(col.id)}
              >
                <TableSortLabel
                  active={sortConfig?.key === col.id}
                  direction={sortConfig?.key === col.id ? sortConfig.direction : 'asc'}
                  onClick={(e) => {
                    e.stopPropagation();
                    requestSort(col.id);
                  }}
                >
                  {col.label}
                </TableSortLabel>
              </TableCell>
            ))}
            {/* Current Task column header — hidden when SHOW_CURRENT_TASK is false */}
            {SHOW_CURRENT_TASK && (
              <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 700, minWidth: 110, fontSize: { md: '0.8rem', xl: '0.875rem' } }}>
                Current Task
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            sortedData.map((batch) => (
              <BatchRow
                key={batch.batchName}
                batch={batch}
                currentTask={SHOW_CURRENT_TASK ? currentTaskMap[batch.batchName] : undefined}
                ctLoading={ctLoading}
                onClick={openBatchModal}
              />
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

BatchTable.propTypes = {
  batches:   PropTypes.array,
  isLoading: PropTypes.bool,
  isError:   PropTypes.bool,
};
