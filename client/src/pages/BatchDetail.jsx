/**
 * BatchDetail.jsx — full-page detail view for a single batch.
 * Navigated to from the dashboard table or via the modal "Open detail" button.
 */

import React from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Container, Box, Typography, Chip, Divider, Grid, Paper,
  Breadcrumbs, Link, Skeleton, Alert, Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { CommandViewer } from '../components/CommandViewer/CommandViewer';
import { useBatchById }  from '../hooks/useBatches';
import { formatDate }    from '../utils/helpers';
import { STATUS_COLORS, COLUMN_LABELS } from '../utils/constants';

function DetailRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <>
      <Grid item xs={12} sm={4}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>{label}</Typography>
      </Grid>
      <Grid item xs={12} sm={8}>
        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{value}</Typography>
      </Grid>
      <Grid item xs={12}><Divider /></Grid>
    </>
  );
}

export default function BatchDetail() {
  const { id } = useParams();
  const { data: batch, isLoading, isError, error } = useBatchById(id);

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Skeleton height={40} width="40%" />
        <Skeleton height={300} sx={{ mt: 2 }} />
      </Container>
    );
  }

  if (isError) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.message || 'Batch not found.'}
        </Alert>
        <Button component={RouterLink} to="/" startIcon={<ArrowBackIcon />}>
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      {/* Breadcrumb */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/" underline="hover" color="inherit">
          Dashboard
        </Link>
        <Typography color="text.primary">{batch.batchName}</Typography>
      </Breadcrumbs>

      {/* Title row */}
      <Box display="flex" alignItems="center" gap={1.5} mb={3}>
        <Typography variant="h5" fontWeight={700}>{batch.batchName}</Typography>
        <Chip
          label={batch.lastRunStatus || 'Unknown'}
          color={STATUS_COLORS[batch.lastRunStatus] || 'default'}
        />
        <Chip label={batch.domain}      variant="outlined" />
        <Chip label={batch.environment} variant="outlined" size="small" />
      </Box>

      {/* Metadata section */}
      <Paper elevation={2} sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={1.5}>Batch Metadata</Typography>
        <Grid container spacing={1}>
          <DetailRow label={COLUMN_LABELS.batchId}       value={batch.batchId} />
          <DetailRow label={COLUMN_LABELS.description}   value={batch.description} />
          <DetailRow label={COLUMN_LABELS.domain}        value={batch.domain} />
          <DetailRow label={COLUMN_LABELS.frequency}     value={batch.frequency} />
          <DetailRow label={COLUMN_LABELS.scheduleTime}  value={batch.scheduleTime} />
          <DetailRow label={COLUMN_LABELS.ownerTeam}     value={batch.ownerTeam} />
          <DetailRow label={COLUMN_LABELS.environment}   value={batch.environment} />
          <DetailRow label={COLUMN_LABELS.lastRunStatus} value={batch.lastRunStatus} />
          <DetailRow label={COLUMN_LABELS.lastRunTime}   value={formatDate(batch.lastRunTime)} />
          <DetailRow label={COLUMN_LABELS.nextRunTime}   value={formatDate(batch.nextRunTime)} />
          <DetailRow label={COLUMN_LABELS.notes}         value={batch.notes} />
        </Grid>
      </Paper>

      {/* Commands section */}
      <Paper elevation={2} sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={1.5}>Server Commands</Typography>
        <CommandViewer batch={batch} />
      </Paper>

      <Box mt={3}>
        <Button component={RouterLink} to="/" startIcon={<ArrowBackIcon />} variant="outlined">
          Back to Dashboard
        </Button>
      </Box>
    </Container>
  );
}
