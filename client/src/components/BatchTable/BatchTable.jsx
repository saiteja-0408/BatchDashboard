/**
 * BatchTable.jsx — sortable, clickable batch data table.
 *
 * Columns: [warn] Batch Name | Schedule Name | Arguments | Sheet | Current Task
 *
 * The "Current Task" column is shown on both Benefits and Tax tabs.
 * It auto-refreshes every 60 s via the useCurrentTasks hook (React Query polling).
 * On mobile (<600px) renders a card list.
 * Rows support keyboard navigation (Enter key opens detail modal).
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, Paper, Typography, Box, Card, CardContent,
  CardActionArea, Skeleton, Stack, Chip, Tooltip, useMediaQuery, useTheme,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useBatchContext }    from '../../context/BatchContext';
import { useSort }            from '../../hooks/useSort';
import { useCurrentTasks }    from '../../hooks/useBatches';
import { CurrentTaskBadge }   from '../CurrentTaskBadge/CurrentTaskBadge';
import { SORTABLE_COLUMNS, SHEET_LABELS, VALID_SCHEDULE_NAMES } from '../../utils/constants';

/** Loading skeleton rows */
function SkeletonRows({ count = 8, extraCol = false }) {
  return Array.from({ length: count }).map((_, i) => (
    <TableRow key={i}>
      <TableCell />
      {SORTABLE_COLUMNS.map((col) => (
        <TableCell key={col.id}>
          <Skeleton variant="text" width="80%" />
        </TableCell>
      ))}
      {extraCol && <TableCell><Skeleton variant="rounded" width={80} height={22} /></TableCell>}
    </TableRow>
  ));
}

SkeletonRows.propTypes = { count: PropTypes.number, extraCol: PropTypes.bool };

/** Mobile card for a single batch */
function BatchCard({ batch, currentTask, onClick }) {
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
              {currentTask && (
                <CurrentTaskBadge currentTask={currentTask} isLoading={false} />
              )}
            </Stack>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block">
            {batch.scheduleName || '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {SHEET_LABELS[batch.sheetSource] || batch.sheetSource}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

BatchCard.propTypes = {
  batch:       PropTypes.object.isRequired,
  currentTask: PropTypes.object,
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

  // Always show Current Task column — both Benefits and Tax have parseable schedule names
  const showCurrentTask = true;

  // Fetch current-task data for the active sheet; re-fetches every 60 s
  const {
    data:      currentTasksEnvelope,
    isLoading: ctLoading,
  } = useCurrentTasks(activeSheet, true);

  // Build a batchName → currentTask lookup map for O(1) cell rendering
  const currentTaskMap = useMemo(() => {
    if (!currentTasksEnvelope?.data) return {};
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
          No batches found. Upload an Excel file with Benefits and Tax sheets to get started.
        </Typography>
      </Box>
    );
  }

  // ── Mobile card layout ────────────────────────────────────────────────────
  if (isMobile) {
    if (isLoading) return <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />;
    return (
      <Box>
        {sortedData.map((b, i) => (
          <BatchCard
            key={`${b.batchName}-${i}`}
            batch={b}
            currentTask={showCurrentTask ? currentTaskMap[b.batchName] : null}
            onClick={openBatchModal}
          />
        ))}
      </Box>
    );
  }

  // ── Desktop table layout ──────────────────────────────────────────────────
  return (
    <TableContainer component={Paper} elevation={2}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {/* Warning indicator column — no sort */}
            <TableCell sx={{ width: 32 }} />
            {SORTABLE_COLUMNS.map((col) => (
              <TableCell key={col.id} sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                <TableSortLabel
                  active={sortConfig?.key === col.id}
                  direction={sortConfig?.key === col.id ? sortConfig.direction : 'asc'}
                  onClick={() => requestSort(col.id)}
                >
                  {col.label}
                </TableSortLabel>
              </TableCell>
            ))}
            {/* Current Task column — Tax sheet only */}
            {showCurrentTask && (
              <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 700, minWidth: 130 }}>
                Current Task
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <SkeletonRows extraCol={showCurrentTask} />
          ) : (
            sortedData.map((batch, i) => {
              const isValid = VALID_SCHEDULE_NAMES.has(batch.scheduleName);
              return (
                <TableRow
                  key={`${batch.batchName}-${i}`}
                  hover
                  tabIndex={0}
                  sx={{
                    cursor: 'pointer',
                    borderLeft: isValid ? undefined : '3px solid #ed6c02',
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
                  }}
                  onClick={() => openBatchModal(batch)}
                  onKeyDown={(e) => { if (e.key === 'Enter') openBatchModal(batch); }}
                >
                  {/* Warning icon cell */}
                  <TableCell sx={{ px: 1, width: 32 }}>
                    {!isValid && (
                      <Tooltip title={`Unknown schedule: "${batch.scheduleName}"`}>
                        <WarningAmberIcon fontSize="small" color="warning" />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{batch.batchName}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {batch.scheduleName || (
                      <Typography variant="caption" color="error">missing</Typography>
                    )}
                  </TableCell>
                  <TableCell
                    sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    <Tooltip title={batch.arguments || ''} placement="top">
                      <span>
                        {batch.arguments || (
                          <Typography component="span" variant="caption" color="text.secondary">—</Typography>
                        )}
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={SHEET_LABELS[batch.sheetSource] || batch.sheetSource}
                      size="small"
                      variant="outlined"
                      color={batch.sheetSource === 'benefits' ? 'primary' : 'secondary'}
                    />
                  </TableCell>
                  {/* Current Task cell — Tax sheet only */}
                  {showCurrentTask && (
                    <TableCell
                      onClick={(e) => e.stopPropagation()} // prevent row click when hovering badge
                      sx={{ py: 0.5 }}
                    >
                      <CurrentTaskBadge
                        currentTask={currentTaskMap[batch.batchName]}
                        isLoading={ctLoading && !currentTaskMap[batch.batchName]}
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })
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
