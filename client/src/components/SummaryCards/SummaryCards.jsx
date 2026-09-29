/**
 * SummaryCards.jsx — dashboard summary section with stat cards and domain/status charts.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Grid, Card, CardContent, Typography, Box, Skeleton, Chip,
} from '@mui/material';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useSummary } from '../../hooks/useBatches';

const COLORS = ['#1976d2', '#7c5cd8', '#2e7d32', '#ed6c02', '#d32f2f'];

function StatCard({ label, value, color }) {
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
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  color: PropTypes.string,
};

function DomainChart({ byDomain }) {
  const data = Object.entries(byDomain || {}).map(([name, value]) => ({ name, value }));
  if (!data.length) return null;
  return (
    <Card elevation={2} sx={{ height: '100%', minHeight: 200 }}>
      <CardContent>
        <Typography variant="subtitle2" gutterBottom fontWeight={700}>
          By Domain
        </Typography>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie dataKey="value" data={data} cx="50%" cy="50%" outerRadius={60} label>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

DomainChart.propTypes = { byDomain: PropTypes.object };

function StatusChart({ byStatus }) {
  const data = Object.entries(byStatus || {}).map(([name, value]) => ({ name, value }));
  if (!data.length) return null;
  return (
    <Card elevation={2} sx={{ height: '100%', minHeight: 200 }}>
      <CardContent>
        <Typography variant="subtitle2" gutterBottom fontWeight={700}>
          By Status
        </Typography>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie dataKey="value" data={data} cx="50%" cy="50%" outerRadius={60} label>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

StatusChart.propTypes = { byStatus: PropTypes.object };

export function SummaryCards() {
  const { data: summary, isLoading, isError } = useSummary();

  if (isLoading) {
    return (
      <Grid container spacing={2} mb={3}>
        {[...Array(6)].map((_, i) => (
          <Grid item xs={6} sm={4} md={2} key={i}>
            <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (isError || !summary) return null;

  return (
    <Grid container spacing={2} mb={3}>
      <Grid item xs={6} sm={4} md={2}>
        <StatCard label="Total Batches"    value={summary.total} />
      </Grid>
      <Grid item xs={6} sm={4} md={2}>
        <StatCard label="Active"           value={summary.active}   color="success.main" />
      </Grid>
      <Grid item xs={6} sm={4} md={2}>
        <StatCard label="Inactive"         value={summary.inactive} color="text.secondary" />
      </Grid>
      <Grid item xs={6} sm={4} md={2}>
        <StatCard label="Running Today"    value={summary.runningToday} color="info.main" />
      </Grid>
      <Grid item xs={6} sm={4} md={2}>
        <StatCard label="Failed"           value={summary.failed}   color="error.main" />
      </Grid>
      <Grid item xs={6} sm={4} md={2}>
        <Box display="flex" flexDirection="column" gap={1}>
          {Object.entries(summary.byDomain || {}).map(([domain, count]) => (
            <Chip key={domain} label={`${domain}: ${count}`} size="small" variant="outlined" />
          ))}
        </Box>
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <DomainChart byDomain={summary.byDomain} />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <StatusChart byStatus={summary.byStatus} />
      </Grid>
    </Grid>
  );
}
