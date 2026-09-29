/**
 * BatchTable.jsx — sortable, clickable batch data table.
 * On mobile (<600px) renders a card list instead of a table.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, Paper, Chip, Typography, Box, Card, CardContent,
  CardActionArea, Skeleton, Stack, useMediaQuery, useTheme,
} from '@mui/material';
import { useBatchContext } from '../../context/BatchContext';
import { useSort } from '../../hooks/useSort';
import { formatDate } from '../../utils/helpers';
import { STATUS_COLORS, SORTABLE_COLUMNS } from '../../utils/constants';

/** Loading skeleton rows */
function SkeletonRows({ count = 5 }) {
  return Array.from({ length: count }).map((_, i) => (
    <TableRow key={i}>
      {SORTABLE_COLUMNS.slice(0, 8).map((col) => (
        <TableCell key={col.id}>
          <Skeleton variant="text" width="80%" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

/** Mobile card for a single batch */
function BatchCard({ batch, onClick }) {
  return (
    <Card elevation={1} sx={{ mb: 1 }}>
      <CardActionArea onClick={() => onClick(batch)}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" fontWeight={700}>{batch.batchName}</Typography>
            <Chip
              label={batch.lastRunStatus || '—'}
              color={STATUS_COLORS[batch.lastRunStatus] || 'default'}
              size="small"
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {batch.batchId} · {batch.domain} · {batch.frequency} · {batch.environment}
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary">
            Last run: {formatDate(batch.lastRunTime)}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

BatchCard.propTypes = {
  batch:   PropTypes.object.isRequired,
  onClick: PropTypes.func.isRequired,
};

/**
 * @param {{ batches: Object[], isLoading: boolean, isError: boolean }} props
 */
export function BatchTable({ batches, isLoading, isError }) {
  const { openBatchModal } = useBatchContext();
  const { sortedData, sortConfig, requestSort } = useSort(batches);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (isError) {
    return (
      <Box p={4} textAlign="center">
        <Typography color="error">Failed to load batch data. Check that the server is running and the Excel file is present.</Typography>
      </Box>
    );
  }

  if (!isLoading && sortedData.length === 0) {
    return (
      <Box p={4} textAlign="center">
        <Typography color="text.secondary">No batches found matching your search or filters.</Typography>
      </Box>
    );
  }

  // ── Mobile card layout ───────────────────────────────────────────────────
  if (isMobile) {
    if (isLoading) return <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />;
    return (
      <Box>
        {sortedData.map((b) => (
          <BatchCard key={b.batchId} batch={b} onClick={openBatchModal} />
        ))}
      </Box>
    );
  }

  // ── Desktop table layout ─────────────────────────────────────────────────
  return (
    <TableContainer component={Paper} elevation={2}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {SORTABLE_COLUMNS.map((col) => (
              <TableCell key={col.id} sx={{ whiteSpace: 'nowrap' }}>
                <TableSortLabel
                  active={sortConfig?.key === col.id}
                  direction={sortConfig?.key === col.id ? sortConfig.direction : 'asc'}
                  onClick={() => requestSort(col.id)}
                >
                  {col.label}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            sortedData.map((batch) => (
              <TableRow
                key={batch.batchId}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => openBatchModal(batch)}
              >
                <TableCell>{batch.batchId}</TableCell>
                <TableCell>{batch.batchName}</TableCell>
                <TableCell>{batch.domain}</TableCell>
                <TableCell>{batch.frequency}</TableCell>
                <TableCell>{batch.scheduleTime}</TableCell>
                <TableCell>
                  <Chip
                    label={batch.lastRunStatus || '—'}
                    color={STATUS_COLORS[batch.lastRunStatus] || 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(batch.lastRunTime)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(batch.nextRunTime)}</TableCell>
                <TableCell>
                  <Chip label={batch.environment} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{batch.ownerTeam}</TableCell>
              </TableRow>
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
