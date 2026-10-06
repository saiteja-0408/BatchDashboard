/**
 * BatchTable.jsx — clickable batch data table (Benefits & Tax sheets).
 *
 * Columns: Batch Name | Schedule Name | Arguments | Trigger Needed
 *
 * The "Sheet" column has been removed — the active tab already indicates
 * which sheet is displayed.
 *
 * Sorting is intentionally disabled on column headers for the Benefits and
 * Tax sheets. Headers are plain, non-interactive labels with no onClick,
 * no sort icons, and no sort state bindings.
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
 *   - openBatchModal is stable useCallback from context.
 *   - Scroll handler is RAF-throttled so React re-renders fire at most once per
 *     animation frame (~16 ms) instead of on every scroll pixel, eliminating
 *     main-thread jank with 1,000+ rows.
 *   - All per-row sx objects are module-level constants — zero GC pressure
 *     from inline object allocation during list rendering.
 */

import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, Box, Chip, Card, CardContent,
  CardActionArea, Skeleton, Stack, Tooltip, useMediaQuery, useTheme,
} from '@mui/material';
import { useBatchContext }    from '../../context/BatchContext';
import { useCurrentTasks }    from '../../hooks/useBatches';
import { CurrentTaskBadge }   from '../CurrentTaskBadge/CurrentTaskBadge';
import { SORTABLE_COLUMNS }   from '../../utils/constants';

// ── Virtualization constants ──────────────────────────────────────────────────
/**
 * Fixed row height in px — must match the actual rendered MUI Table row.
 * MUI Table size="small" applies py: 6px (top+bottom) = 12px padding.
 * Default body font line-height ≈ 20px. Total: 20 + 12 = 32px.
 * Using 33px gives a 1px safety margin so the virtual window never
 * under-counts visible rows, which would produce a blank strip at the bottom.
 */
const VIRTUAL_ROW_HEIGHT = 33;

/**
 * Extra rows rendered above and below the visible window.
 * 8 rows @ 33px = 264px of buffer — enough to absorb fast scroll momentum
 * without blank gaps becoming visible before the next RAF fires.
 */
const OVERSCAN_COUNT = 8;

/** Feature flag — flip to `true` to restore the Current Task column. */
const SHOW_CURRENT_TASK = false;

// ── Module-level sx constants — allocated once, never recreated per render ───
const TABLE_CONTAINER_SX = {
  overflowX: 'auto',
  overflowY: 'auto',
  width:     '100%',
  maxWidth:  '100%',
};

const TABLE_SX = {
  tableLayout: 'fixed',
  width:       '100%',
  minWidth:    700,
};

const HEADER_CELL_SX = {
  whiteSpace:       'nowrap',
  fontWeight:       700,
  fontSize:         { md: '0.8rem', xl: '0.875rem' },
  backgroundColor:  'background.paper',
};

const SPACER_ROW_SX  = { border: 0 };
const SPACER_CELL_SX = { p: 0, border: 0 };

const ROW_SX = {
  cursor: 'pointer',
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
};

const CELL_NAME_SX = {
  fontWeight:    500,
  overflow:      'hidden',
  textOverflow:  'ellipsis',
  whiteSpace:    'nowrap',
};

const CELL_SCHEDULE_SX = {
  fontFamily:    'monospace',
  fontSize:      'clamp(0.72rem, 0.85vw, 0.85rem)',
  overflow:      'hidden',
  textOverflow:  'ellipsis',
  whiteSpace:    'nowrap',
};

const CELL_ARGS_SX = {
  overflow:      'hidden',
  textOverflow:  'ellipsis',
  whiteSpace:    'nowrap',
};

const CELL_TRIGGER_SX = {
  overflow:   'hidden',
  whiteSpace: 'nowrap',
};

// ── TriggerBadge ─────────────────────────────────────────────────────────────

const CHIP_Y_SX = { bgcolor: 'success.main', color: 'success.contrastText', fontWeight: 700, fontSize: '0.72rem', height: 20 };
const CHIP_N_SX = { bgcolor: 'error.main',   color: 'error.contrastText',   fontWeight: 700, fontSize: '0.72rem', height: 20 };

function TriggerBadge({ value }) {
  if (value === 'Y') return <Chip label="Y" size="small" sx={CHIP_Y_SX} />;
  if (value === 'N') return <Chip label="N" size="small" sx={CHIP_N_SX} />;
  return <Typography variant="caption" color="text.secondary">—</Typography>;
}

// ── SkeletonRows ─────────────────────────────────────────────────────────────

function SkeletonRows({ count = 8 }) {
  return Array.from({ length: count }).map((_, i) => (
    <TableRow key={i}>
      {SORTABLE_COLUMNS.map((col) => (
        <TableCell key={col.id}><Skeleton variant="text" width="80%" /></TableCell>
      ))}
      {SHOW_CURRENT_TASK && (
        <TableCell><Skeleton variant="rounded" width={80} height={22} /></TableCell>
      )}
    </TableRow>
  ));
}
SkeletonRows.propTypes = { count: PropTypes.number };

// ── BatchCard (mobile) ───────────────────────────────────────────────────────

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

// ── BatchRow (desktop) ───────────────────────────────────────────────────────

const BatchRow = React.memo(function BatchRow({ batch, currentTask, ctLoading, onClick }) {
  const handleClick   = useCallback(() => onClick(batch), [batch, onClick]);
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
      <TableCell sx={CELL_NAME_SX}>
        <Tooltip title={batch.batchName} placement="top-start">
          <span>{batch.batchName}</span>
        </Tooltip>
      </TableCell>
      <TableCell sx={CELL_SCHEDULE_SX}>
        {batch.scheduleName ? (
          <Tooltip title={batch.scheduleName} placement="top-start">
            <span>{batch.scheduleName}</span>
          </Tooltip>
        ) : (
          <Typography variant="caption" color="error">missing</Typography>
        )}
      </TableCell>
      <TableCell sx={CELL_ARGS_SX}>
        <Tooltip title={batch.arguments || ''} placement="top">
          <span>
            {batch.arguments || (
              <Typography component="span" variant="caption" color="text.secondary">—</Typography>
            )}
          </span>
        </Tooltip>
      </TableCell>
      <TableCell sx={CELL_TRIGGER_SX}>
        <TriggerBadge value={batch.triggerNeeded} />
      </TableCell>
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

// ── BatchTable ────────────────────────────────────────────────────────────────

/** @param {{ batches: Object[], isLoading: boolean, isError: boolean }} props */
export function BatchTable({ batches, isLoading, isError }) {
  const { openBatchModal, activeSheet } = useBatchContext();
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    data:      currentTasksEnvelope,
    isLoading: ctLoading,
  } = useCurrentTasks(SHOW_CURRENT_TASK ? activeSheet : null, SHOW_CURRENT_TASK);

  const currentTaskMap = useMemo(() => {
    if (!SHOW_CURRENT_TASK || !currentTasksEnvelope?.data) return {};
    return Object.fromEntries(
      currentTasksEnvelope.data.map((r) => [r.batchName, r.currentTask])
    );
  }, [currentTasksEnvelope]);

  // ── Virtualization state ──────────────────────────────────────────────────
  const containerRef  = useRef(null);
  const rafRef        = useRef(null);            // RAF handle for scroll throttle
  const [tableHeight, setTableHeight] = useState(500);
  const [scrollTop,   setScrollTop]   = useState(0);

  // Sorting disabled — display order matches server/upload order exactly.
  const sortedData = batches ?? [];

  // Reset scroll whenever the dataset changes (tab switch, search, upload).
  useEffect(() => {
    setScrollTop(0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [batches]);

  // Recalculate container height on window resize.
  useEffect(() => {
    const updateHeight = () => {
      const targetH = Math.max(300, Math.min(window.innerHeight - 320, 680));
      setTableHeight(targetH);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  /**
   * RAF-throttled scroll handler.
   * Batches scroll events into a single React state update per animation frame
   * (~16 ms) instead of one per pixel scrolled. With 1,000 rows this reduces
   * scroll-driven re-renders from ~60/s to exactly 60/s (one per frame) while
   * keeping the virtual window perfectly in sync with the viewport.
   */
  const handleScroll = useCallback((e) => {
    const target = e.currentTarget;
    if (rafRef.current) return; // already scheduled — skip duplicate events this frame
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setScrollTop(target.scrollTop);
    });
  }, []);

  // Cancel any pending RAF on unmount to avoid setState after unmount.
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // ── Virtual window calculation ────────────────────────────────────────────
  const totalCount    = sortedData.length;
  const startIndex    = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - OVERSCAN_COUNT);
  const endIndex      = Math.min(
    totalCount,
    Math.ceil((scrollTop + tableHeight) / VIRTUAL_ROW_HEIGHT) + OVERSCAN_COUNT
  );
  const paddingTop    = startIndex * VIRTUAL_ROW_HEIGHT;
  const paddingBottom = Math.max(0, (totalCount - endIndex) * VIRTUAL_ROW_HEIGHT);
  const columnCount   = SORTABLE_COLUMNS.length + (SHOW_CURRENT_TASK ? 1 : 0);

  const visibleBatches = useMemo(
    () => sortedData.slice(startIndex, endIndex),
    [sortedData, startIndex, endIndex]
  );

  // ── Early returns (after all hooks) ──────────────────────────────────────
  if (isError) {
    return (
      <Box p={4} textAlign="center">
        <Typography color="error">
          Failed to load batch data. Check that the server is running and the Excel file is present.
        </Typography>
      </Box>
    );
  }

  if (!isLoading && sortedData.length === 0) {
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

  // ── Desktop table layout with row virtualization ──────────────────────────
  return (
    <TableContainer
      component={Paper}
      elevation={0}
      ref={containerRef}
      onScroll={handleScroll}
      sx={{ ...TABLE_CONTAINER_SX, maxHeight: tableHeight }}
    >
      <Table size="small" stickyHeader sx={TABLE_SX}>
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '33%' }} />
          <col style={{ width: '12%' }} />
        </colgroup>
        <TableHead>
          <TableRow>
            {SORTABLE_COLUMNS.map((col) => (
              <TableCell key={col.id} sx={HEADER_CELL_SX}>
                {col.label}
              </TableCell>
            ))}
            {SHOW_CURRENT_TASK && (
              <TableCell sx={{ ...HEADER_CELL_SX, minWidth: 110 }}>
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
                <TableRow sx={{ ...SPACER_ROW_SX, height: paddingTop }}>
                  <TableCell colSpan={columnCount} sx={{ ...SPACER_CELL_SX, height: paddingTop }} />
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
                <TableRow sx={{ ...SPACER_ROW_SX, height: paddingBottom }}>
                  <TableCell colSpan={columnCount} sx={{ ...SPACER_CELL_SX, height: paddingBottom }} />
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
