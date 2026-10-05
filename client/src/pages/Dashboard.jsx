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

import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  Box, Container, Typography, Button, Stack,
  CircularProgress, Alert, Snackbar,
} from '@mui/material';
import RefreshIcon      from '@mui/icons-material/Refresh';
import UploadFileIcon   from '@mui/icons-material/UploadFile';
import { useQueryClient } from '@tanstack/react-query';

import { SheetTabs }        from '../components/SheetTabs/SheetTabs';
import { SearchBar }        from '../components/SearchBar/SearchBar';
import { BatchTable }       from '../components/BatchTable/BatchTable';
import { BatchDetailModal } from '../components/BatchDetailModal/BatchDetailModal';
import { StatusReportTab }  from '../components/StatusReportTab/StatusReportTab';

import { useBatchContext }   from '../context/BatchContext';
import { useAllBatches }     from '../hooks/useBatches';
import { uploadSheet }       from '../services/apiService';
import { useStatusReport }   from '../hooks/useStatusReport';

export default function Dashboard() {
  const queryClient  = useQueryClient();
  const fileInputRef = useRef(null);

  const { searchQuery, activeSheet } = useBatchContext();

  // ── Upload state ──────────────────────────────────────────────────────────
  const [uploading,    setUploading]    = useState(false);
  const [snackbar,     setSnackbar]     = useState({ open: false, message: '', severity: 'success' });

  const isStatusReportTab = activeSheet === 'status-report';

  // Status Report hook — enabled only on the Status Report tab.
  // Shares the same React Query cache key as the hook inside StatusReportTab,
  // so this call never triggers a second network request.
  const {
    isFetching: srFetching,
    refresh:    srRefresh,
    data:       srEnvelope,
  } = useStatusReport(isStatusReportTab);

  const srCachedAt = srEnvelope?.cachedAt ?? null;
  const srCacheHit = srEnvelope?.cacheHit ?? null;

  // Only fetch batch data when on the Benefits or Tax tab.
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
      // Guard all three fields with (|| '') so a null/undefined scheduleName or
      // batchName never throws "Cannot read properties of null (reading 'toLowerCase')",
      // which would silently break the filter and leave the table empty/frozen.
      (b.batchName    || '').toLowerCase().includes(q) ||
      (b.scheduleName || '').toLowerCase().includes(q) ||
      (b.arguments    || '').toLowerCase().includes(q)
    );
  }, [allBatches, searchQuery, isStatusReportTab]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  // ── Upload handlers ───────────────────────────────────────────────────────

  /** Open the hidden file input when the Upload button is clicked. */
  const handleUploadClick = useCallback(() => {
    if (fileInputRef.current) {
      // Reset value so selecting the same file again re-triggers onChange
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  /** Called when the user picks a file. */
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadSheet(activeSheet, file);
      // Invalidate TanStack Query cache so the table refreshes from new server data
      await queryClient.invalidateQueries({ queryKey: ['batches'] });
      setSnackbar({
        open:     true,
        message:  result.message || `Uploaded successfully — ${result.count} batch(es) loaded.`,
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({
        open:     true,
        message:  err.message || 'Upload failed. Please check the file and try again.',
        severity: 'error',
      });
    } finally {
      setUploading(false);
    }
  }, [activeSheet, queryClient]);

  const handleSnackbarClose = useCallback((_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

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
          {/* Last-updated caption — batch tabs show React Query timestamp; Status Report shows DB cache time */}
          {isStatusReportTab && srCachedAt && (
            <Typography variant="caption" color="text.secondary">
              Last updated: {new Date(srCachedAt).toLocaleTimeString()}
              {srCacheHit === true  && ' (cached)'}
              {srCacheHit === false && ' (live)'}
            </Typography>
          )}
          {!isStatusReportTab && lastUpdated && (
            <Typography variant="caption" color="text.secondary">
              Last refreshed: {lastUpdated}
            </Typography>
          )}
        </Box>

        {/* Action buttons — right side of header */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          {isStatusReportTab ? (
            /* ── Status Report: single Refresh button ── */
            <Button
              size="small"
              variant="outlined"
              startIcon={srFetching
                ? <CircularProgress size={14} color="inherit" />
                : <RefreshIcon />}
              onClick={srRefresh}
              disabled={srFetching}
            >
              Refresh
            </Button>
          ) : (
            /* ── Benefits / Tax: Refresh + Upload ── */
            <>
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['batches'] })}
              >
                Refresh
              </Button>

              {/* Hidden file input — triggered programmatically */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm,.xlsb,.csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              <Button
                size="small"
                variant="outlined"
                startIcon={uploading ? <CircularProgress size={14} color="inherit" /> : <UploadFileIcon />}
                onClick={handleUploadClick}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : `Upload ${activeSheet === 'benefits' ? 'Benefits' : 'Tax'} Sheet`}
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {/* Sheet selector tabs — Status Report | Benefits | Tax */}
      <SheetTabs />

      {isStatusReportTab ? (
        /* ── Status Report tab — full-width table, no search ── */
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

      {/* Upload feedback snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
