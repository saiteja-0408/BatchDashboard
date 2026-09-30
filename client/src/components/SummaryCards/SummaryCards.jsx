/**
 * SummaryCards.jsx — dashboard summary section.
 * Shows total, by-sheet counts, and invalid schedule count as stat cards.
 * Pie charts removed for a cleaner, faster layout.
 */

import React from 'react';
import {
  Grid, Card, CardContent, Typography, Skeleton, Alert,
} from '@mui/material';
import { useSummary } from '../../hooks/useBatches';

/** Memoised to prevent re-render when parent re-renders for unrelated reasons */
const StatCard = React.memo(function StatCard({ label, value, color }) {
  return (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        <Typography variant="h4" fontWeight={700} color={color || 'text.primary'}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
});

export function SummaryCards() {
  const { data: summary, isLoading, isError } = useSummary();

  if (isLoading) {
    return (
      <Grid container spacing={2} mb={3}>
        {[...Array(4)].map((_, i) => (
          <Grid item xs={6} sm={4} md={3} key={i}>
            <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 2 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (isError || !summary) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        No batch data loaded. Check that <strong>benefits.xlsx</strong> and{' '}
        <strong>tax.xlsx</strong> are present in the <code>data/</code> directory.
      </Alert>
    );
  }

  return (
    <Grid container spacing={2} mb={3}>
      <Grid item xs={6} sm={3} md={3}>
        <StatCard label="Total Batches"     value={summary.total} />
      </Grid>
      <Grid item xs={6} sm={3} md={3}>
        <StatCard label="Benefits"          value={summary.benefits} color="primary.main" />
      </Grid>
      <Grid item xs={6} sm={3} md={3}>
        <StatCard label="Tax"               value={summary.tax}     color="secondary.main" />
      </Grid>
      <Grid item xs={6} sm={3} md={3}>
        <StatCard
          label="Unknown Schedules"
          value={summary.invalid}
          color={summary.invalid > 0 ? 'warning.main' : 'text.secondary'}
        />
      </Grid>
    </Grid>
  );
}
