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

/**
 * Memoised stat card — scales from compact mobile to large 4K cards.
 * On xl+ screens the number uses a larger fluid font to fill the extra space.
 */
const StatCard = React.memo(function StatCard({ label, value, color }) {
  return (
    // elevation={0} → single thin border from theme (no drop-shadow doubling)
    <Card elevation={0} sx={{ height: '100%' }}>
      <CardContent
        sx={{
          p: { xs: 1.5, sm: 2, lg: 2.5 },
          '&:last-child': { pb: { xs: 1.5, sm: 2, lg: 2.5 } },
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          gutterBottom
          noWrap
          sx={{ fontSize: { xs: '0.75rem', lg: '0.85rem', xl: '0.9rem' } }}
        >
          {label}
        </Typography>
        <Typography
          variant="h4"
          fontWeight={700}
          color={color || 'text.primary'}
          sx={{
            // Fluid: compact on phones, large on 1440p/4K
            fontSize: { xs: '1.6rem', sm: '2rem', md: '2.125rem', xl: '2.5rem' },
            lineHeight: 1.1,
          }}
        >
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
      <Grid container spacing={{ xs: 2, lg: 3 }} mb={{ xs: 3, lg: 4 }}>
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
    /*
     * Grid breakpoints:
     *   xs:  2 cards / row  (phones)
     *   sm:  4 cards / row  (tablets → fills the row)
     *   xl:  4 cards / row  (1440p — each card widens naturally via auto column width)
     *
     * spacing increases on lg+ so cards breathe on large screens.
     */
    <Grid container spacing={{ xs: 2, lg: 3 }} mb={{ xs: 3, lg: 4 }}>
      <Grid item xs={6} sm={3}>
        <StatCard label="Total Batches"    value={summary.total} />
      </Grid>
      <Grid item xs={6} sm={3}>
        <StatCard label="Benefits"         value={summary.benefits} color="primary.main" />
      </Grid>
      <Grid item xs={6} sm={3}>
        <StatCard label="Tax"              value={summary.tax}      color="secondary.main" />
      </Grid>
      <Grid item xs={6} sm={3}>
        <StatCard
          label="Unknown Schedules"
          value={summary.invalid}
          color={summary.invalid > 0 ? 'warning.main' : 'text.secondary'}
        />
      </Grid>
    </Grid>
  );
}
