/**
 * Dashboard.jsx — main landing page.
 *
 * Orchestrates: summary cards, search bar, filter panel, batch table,
 * detail modal, and export button.
 */

import React, { useMemo } from 'react';
import {
  Box, Container, Typography, Button, Stack, Divider,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useQueryClient } from '@tanstack/react-query';

import { SummaryCards }      from '../components/SummaryCards/SummaryCards';
import { SearchBar }         from '../components/SearchBar/SearchBar';
import { FilterPanel }       from '../components/FilterPanel/FilterPanel';
import { BatchTable }        from '../components/BatchTable/BatchTable';
import { BatchDetailModal }  from '../components/BatchDetailModal/BatchDetailModal';

import { useBatchContext }    from '../context/BatchContext';
import { useAllBatches }      from '../hooks/useBatches';
import { exportToExcel }      from '../utils/helpers';

export default function Dashboard() {
  const queryClient                            = useQueryClient();
  const { searchQuery, filters }               = useBatchContext();
  const { data: allBatches, isLoading, isError, dataUpdatedAt } = useAllBatches();

  /**
   * Client-side filtering: apply search and filter on the already-fetched list.
   * This avoids extra API round-trips for simple filter changes while React Query
   * handles background revalidation of the base list.
   */
  const filteredBatches = useMemo(() => {
    if (!allBatches) return [];
    let result = allBatches;

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) =>
        Object.values(b).some((v) => typeof v === 'string' && v.toLowerCase().includes(q))
      );
    }

    // Dropdown filters
    if (filters.domain)    result = result.filter((b) => b.domain.toLowerCase()        === filters.domain.toLowerCase());
    if (filters.frequency) result = result.filter((b) => b.frequency.toLowerCase()     === filters.frequency.toLowerCase());
    if (filters.status)    result = result.filter((b) => b.lastRunStatus.toLowerCase() === filters.status.toLowerCase());

    return result;
  }, [allBatches, searchQuery, filters]);

  const handleExport = () => exportToExcel(filteredBatches, 'batch_export');

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Page heading */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Batch Job Monitor</Typography>
          {lastUpdated && (
            <Typography variant="caption" color="text.secondary">
              Last refreshed: {lastUpdated}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['batches'] })}
          >
            Refresh
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExport}
            disabled={!filteredBatches.length}
          >
            Export CSV ({filteredBatches.length})
          </Button>
        </Stack>
      </Stack>

      {/* Summary statistics */}
      <SummaryCards />

      <Divider sx={{ mb: 2 }} />

      {/* Search + Filters */}
      <Stack spacing={1.5} mb={2}>
        <SearchBar />
        <FilterPanel />
      </Stack>

      {/* Main table */}
      <BatchTable
        batches={filteredBatches}
        isLoading={isLoading}
        isError={isError}
      />

      {/* Batch detail modal (globally mounted — reads from context) */}
      <BatchDetailModal />
    </Container>
  );
}
