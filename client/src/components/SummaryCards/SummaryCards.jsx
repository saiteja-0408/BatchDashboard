/**
 * SummaryCards.jsx — dashboard summary section.
 * Shows total, by-sheet counts, invalid schedule count, and a pie chart.
 */

import React from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Skeleton, Alert,
} from '@mui/material';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useSummary } from '../../hooks/useBatches';

const COLORS = ['#1976d2', '#7c5cd8', '#d32f2f', '#2e7d32'];

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

export function SummaryCards() {
  const { data: summary, isLoading, isError } = useSummary();

  if (isLoading) {
    return (
      <Grid container spacing={2} mb={3}>
        {[...Array(5)].map((_, i) => (
          <Grid item xs={6} sm={4} md={2} key={i}>
            <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 2 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (isError || !summary) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Upload an Excel file with Benefits and Tax sheets to see summary stats.
      </Alert>
    );
  }

  const sheetData = Object.entries(summary.bySheet || {}).map(([name, value]) => ({ name, value }));
  const validityData = Object.entries(summary.byScheduleValidity || {}).map(([name, value]) => ({ name, value }));

  return (
    <Grid container spacing={2} mb={3}>
      <Grid item xs={6} sm={4} md={2}>
        <StatCard label="Total Batches"     value={summary.total} />
      </Grid>
      <Grid item xs={6} sm={4} md={2}>
        <StatCard label="Benefits"          value={summary.benefits} color="primary.main" />
      </Grid>
      <Grid item xs={6} sm={4} md={2}>
        <StatCard label="Tax"               value={summary.tax}      color="secondary.main" />
      </Grid>
      <Grid item xs={6} sm={4} md={2}>
        <StatCard label="Unknown Schedules" value={summary.invalid}  color={summary.invalid > 0 ? 'warning.main' : 'text.secondary'} />
      </Grid>

      {/* By Sheet pie */}
      {sheetData.length > 0 && (
        <Grid item xs={12} sm={6} md={4}>
          <Card elevation={2} sx={{ height: '100%', minHeight: 180 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>By Sheet</Typography>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie dataKey="value" data={sheetData} cx="50%" cy="50%" outerRadius={55} label>
                    {sheetData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Schedule validity pie */}
      {validityData.length > 0 && (
        <Grid item xs={12} sm={6} md={4}>
          <Card elevation={2} sx={{ height: '100%', minHeight: 180 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Schedule Validity</Typography>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie dataKey="value" data={validityData} cx="50%" cy="50%" outerRadius={55} label>
                    {validityData.map((entry, i) => (
                      <Cell key={i} fill={entry.name === 'Invalid' ? '#ed6c02' : '#2e7d32'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
}
