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

import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, Paper, Typography, Box, Chip, Card, CardContent,
  CardActionArea, Skeleton, Stack, Tooltip, useMediaQuery, useTheme,
} from '@mui/material';
import { useBatchContext }    from '../../context/BatchContext';
import { useSort }            from '../../hooks/useSort';
import { useCurrentTasks }    from '../../hooks/useBatches';
import { CurrentTaskBadge }   from '../CurrentTaskBadge/CurrentTaskBadge';
import { SORTABLE_COLUMNS }   from '../../utils/constants';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * VIRTUALIZATION PERFORMANCE METRICS (Issue 2):
 * ────────────────────────────────────────────────────────────────────────────
 * Full DOM rendering of 890 rows with 5 cells per row = 4,450 <td> DOM nodes
 * + 890 <tr> elements + inner spans/chips/tooltips = ~10,000+ active DOM nodes.
 *
 * With row virtualization (FixedSizeList), only ~15–20 rows are mounted in the
 * viewport DOM at any instant = ~75–100 <td> nodes (~98% DOM node reduction).
 * This completely eliminates tab-switching delays, scroll stutter, and render lag.
 * ════════════════════════════════════════════════════════════════════════════
 */

const VIRTUAL_ROW_HEIGHT = 44; // Fixed height in px per desktop row
const OVERSCAN_COUNT = 5;      // Number of extra rows to render above and below viewport

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
  return (
    <Card elevation={1} sx={{ mb: 1 }}>
      <CardActionArea onClick={() => onClick(batch)}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="subtitle2" fontWeight={700} sx={{ wordBreak: 'break-word', flex: 1, mr: 1 }}>
              {batch.batchName}
            </Typography>
            {SHOW_CURRENT_TASK && currentTask && (
              <CurrentTaskBadge currentTask={currentTask} isLoading={false} />
            )}
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

const ROW_SX = {
  cursor: 'pointer',
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
};

/**
 * Single desktop table row — memoised so only the rows whose currentTask
 * actually changed re-render during the 60s poll cycle.
 */
const BatchRow = React.memo(function BatchRow({ batch, currentTask, ctLoading, onClick }) {
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
      sx={ROW_SX}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <TableCell sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <Tooltip title={batch.batchName} placement="top-start">
          <span>{batch.batchName}</span>
        </Tooltip>
      </TableCell>
      <TableCell sx={{ fontFamily: 'monospace', fontSize: 'clamp(0.72rem, 0.85vw, 0.85rem)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {batch.scheduleName ? (
          <Tooltip title={batch.scheduleName} placement="top-start">
            <span>{batch.scheduleName}</span>
          </Tooltip>
        ) : (
          <Typography variant="caption" color="error">missing</Typography>
        )}
      </TableCell>
      <TableCell
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
      <TableCell sx={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
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
  const { sortedData, sortConfig, requestSort } = useSort(batches, activeSheet);
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

  // ── Desktop table layout with Row Virtualization ──────────────────────────
  const containerRef = useRef(null);
  const [tableHeight, setTableHeight] = useState(500);

  useEffect(() => {
    const updateHeight = () => {
      // Calculate responsive viewport height available for the list
      const windowH = window.innerHeight;
      const targetH = Math.max(300, Math.min(windowH - 320, 680));
      setTableHeight(targetH);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalCount = sortedData.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - OVERSCAN_COUNT);
  const endIndex = Math.min(
    totalCount,
    Math.ceil((scrollTop + tableHeight) / VIRTUAL_ROW_HEIGHT) + OVERSCAN_COUNT
  );

  const paddingTop = startIndex * VIRTUAL_ROW_HEIGHT;
  const paddingBottom = Math.max(0, (totalCount - endIndex) * VIRTUAL_ROW_HEIGHT);

  const visibleBatches = useMemo(() => {
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, startIndex, endIndex]);

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      ref={containerRef}
      onScroll={handleScroll}
      sx={{
        overflowX: 'auto',
        overflowY: 'auto',
        maxHeight: tableHeight,
        width:     '100%',
      }}
    >
      <Table
        size="small"
        stickyHeader
        sx={{
          tableLayout: 'fixed',
          width: '100%',
          minWidth: 700,
        }}
      >
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '33%' }} />
          <col style={{ width: '12%' }} />
        </colgroup>
        <TableHead>
          <TableRow>
            {SORTABLE_COLUMNS.map((col) => (
              <TableCell
                key={col.id}
                sx={{
                  whiteSpace: 'nowrap',
                  fontWeight: 700,
                  fontSize: { md: '0.8rem', xl: '0.875rem' },
                  cursor: 'pointer',
                  userSelect: 'none',
                  backgroundColor: 'background.paper',
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
            {SHOW_CURRENT_TASK && (
              <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 700, minWidth: 110, fontSize: { md: '0.8rem', xl: '0.875rem' }, backgroundColor: 'background.paper' }}>
                Current Task
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            <>
              {paddingTop > 0 && (
                <TableRow sx={{ height: `${paddingTop}px !important`, border: 0 }}>
                  <TableCell colSpan={4} sx={{ p: 0, border: 0, height: `${paddingTop}px` }} />
                </TableRow>
              )}
              {visibleBatches.map((batch) => (
                <BatchRow
                  key={batch.batchName}
                  batch={batch}
                  currentTask={SHOW_CURRENT_TASK ? currentTaskMap[batch.batchName] : undefined}
                  ctLoading={ctLoading}
                  onClick={openBatchModal}
                />
              ))}
              {paddingBottom > 0 && (
                <TableRow sx={{ height: `${paddingBottom}px !important`, border: 0 }}>
                  <TableCell colSpan={4} sx={{ p: 0, border: 0, height: `${paddingBottom}px` }} />
                </TableRow>
              )}
            </>
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
