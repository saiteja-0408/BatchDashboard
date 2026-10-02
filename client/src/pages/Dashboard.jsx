/**
 * Dashboard.jsx — main landing page.
 *
 * Orchestrates: sheet tabs, search bar, batch table, and detail modal.
 * The active sheet (benefits / tax) drives which data is shown.
 * Search is applied client-side on the already-fetched batch list.
 *
 * When activeSheet === 'status-report', the batch table and its controls are
 * replaced by the StatusReportTab component.
 */

import React, { useMemo } from 'react';
import {
  Box, Container, Typography, Button, Stack,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RefreshIcon      from '@mui/icons-material/Refresh';
import { useQueryClient } from '@tanstack/react-query';

import { SheetTabs }        from '../components/SheetTabs/SheetTabs';
import { SearchBar }        from '../components/SearchBar/SearchBar';
import { BatchTable }       from '../components/BatchTable/BatchTable';
import { BatchDetailModal } from '../components/BatchDetailModal/BatchDetailModal';
import { StatusReportTab }  from '../components/StatusReportTab/StatusReportTab';

import { useBatchContext }  from '../context/BatchContext';
import { useAllBatches }    from '../hooks/useBatches';
import { exportToExcel }    from '../utils/helpers';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { searchQuery, activeSheet } = useBatchContext();

  const isStatusReportTab = activeSheet === 'status-report';

  // Only fetch batch data when on the Benefits or Tax tab.
  // Passing 'status-report' to useAllBatches would hit the API with an unknown
  // sheet value — guard it with null so the query is disabled.
  const { data: allBatches, isLoading, isError, dataUpdatedAt } = useAllBatches(
    isStatusReportTab ? null : activeSheet
  );

  /**
   * Client-side search applied on the already-fetched batch list.
   * Not used when the Status Report tab is active.
   */
  const filteredBatches = useMemo(() => {
    if (isStatusReportTab || !allBatches) return [];

    if (!searchQuery) return allBatches;

    const q = searchQuery.toLowerCase();
    return allBatches.filter((b) =>
      b.batchName.toLowerCase().includes(q)    ||
      b.scheduleName.toLowerCase().includes(q) ||
      (b.arguments || '').toLowerCase().includes(q)
    );
  }, [allBatches, searchQuery, isStatusReportTab]);

  const handleExport = () => exportToExcel(filteredBatches, `${activeSheet}_batches_export`);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    /*
     * maxWidth={false} — fills the full viewport width at every screen size.
     * py/px props provide the only inset; no centred-column cap is applied.
     */
    <Container
      maxWidth={false}
      sx={{
        py:        { xs: 2, sm: 3, lg: 4 },
        px:        { xs: 1.5, sm: 2, md: 3, lg: 4 },
        overflowX: 'hidden',
      }}
    >
      {/* Page heading */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
        flexWrap="wrap"
        gap={1}
        mb={{ xs: 2, lg: 3 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>Batch Monitoring</Typography>
          {lastUpdated && !isStatusReportTab && (
            <Typography variant="caption" color="text.secondary">
              Last refreshed: {lastUpdated}
            </Typography>
          )}
        </Box>
        {/* Export buttons — only shown on batch tabs */}
        {!isStatusReportTab && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
        )}
      </Stack>

      {/* Sheet selector tabs — Status Report | Benefits | Tax */}
      <SheetTabs />

      {isStatusReportTab ? (
        /* ── Status Report tab — full-width table, no search/filter ── */
        <StatusReportTab enabled />
      ) : (
        /* ── Benefits / Tax tabs — search bar + batch table ── */
        <>
          <Box mb={2}>
            <SearchBar />
          </Box>

          <BatchTable
            batches={filteredBatches}
            isLoading={isLoading}
            isError={isError}
          />
        </>
      )}

      {/* Batch detail modal (globally mounted — reads from context) */}
      <BatchDetailModal />
    </Container>
  );
}
