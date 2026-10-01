/**
 * BatchDetailModal.jsx — full detail modal for a selected batch.
 *
 * Shows batch metadata + Run/Resume commands.
 * Displays a schedule name warning badge when the schedule is not in the approved list.
 *
 * Performance:
 *   - Subscribes to BatchModalContext (useBatchModal) NOT BatchDataContext so it
 *     is the ONLY component that re-renders when a row is clicked.
 *   - Dialog is always mounted — open prop flips between true/false instead of
 *     the entire subtree unmounting/remounting on every open. This eliminates
 *     the cold-mount cost (~35 DOM nodes) that previously occurred on every click.
 *   - transitionDuration reduced to 120ms enter / 80ms exit for snappier feel.
 *   - InfoRow is memoised — stable batch object means it never re-renders needlessly.
 *   - handleClose is stable (useCallback).
 */

import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Chip, Divider,
  Grid, IconButton, Tooltip, Alert,
} from '@mui/material';
import CloseIcon        from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { CommandViewer }   from '../CommandViewer/CommandViewer';
import { COLUMN_LABELS, SHEET_LABELS } from '../../utils/constants';
import { useBatchModal } from '../../context/BatchContext';

/** Memoised — only re-renders when label or value changes */
const InfoRow = React.memo(function InfoRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <>
      <Grid item xs={5} sm={4}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {label}
        </Typography>
      </Grid>
      <Grid item xs={7} sm={8}>
        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
          {value}
        </Typography>
      </Grid>
    </>
  );
});
InfoRow.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export const BatchDetailModal = React.memo(function BatchDetailModal() {
  // Uses the modal-specific context slice — does NOT subscribe to BatchDataContext
  // so BatchDetailModal is the only component that re-renders on row click.
  const { selectedBatch: batch, isModalOpen, closeBatchModal } = useBatchModal();

  const handleClose = useCallback(() => {
    closeBatchModal();
  }, [closeBatchModal]);

  // Derive sheetLabel once per batch change, not on every render.
  // Falls back to the previous batch value while the close animation plays
  // (batch is only cleared 300ms after close, so the label stays visible).
  const sheetLabel = useMemo(
    () => (batch ? (SHEET_LABELS[batch.sheetSource] || batch.sheetSource || '—') : ''),
    [batch]
  );

  // Dialog is always mounted — open/closed is controlled by isModalOpen only.
  // This means the first open is still a cold mount, but every subsequent open
  // is just a prop flip (open: false → true) with no DOM create/destroy work.
  return (
    <Dialog
      open={isModalOpen}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      scroll="paper"
      fullScreen={false}
      // Reduced from MUI default 225ms enter / 195ms exit — cuts perceived lag
      // by ~100ms on every open while still feeling intentional.
      transitionDuration={{ enter: 120, exit: 80 }}
      sx={{
        '& .MuiDialog-paper': {
          m: { xs: 1, sm: 2 },
          maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 32px)' },
          width: { xs: 'calc(100% - 16px)', sm: undefined },
          maxWidth: { xl: '900px', xl2: '1040px' },
        },
      }}
    >
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pb: 1 }}
      >
        <Box sx={{ flex: 1, mr: 1 }}>
          <Typography variant="h6" component="span" sx={{ wordBreak: 'break-word' }}>
            {batch?.batchName}
          </Typography>
          {/* Schedule warning badge in title area */}
          {batch && !batch.scheduleValid && batch.scheduleName && (
            <Tooltip title={`Schedule "${batch.scheduleName}" is not in the approved list`}>
              <Chip
                icon={<WarningAmberIcon fontSize="small" />}
                label="Unknown Schedule"
                color="warning"
                size="small"
                sx={{ ml: 1, verticalAlign: 'middle' }}
              />
            </Tooltip>
          )}
          <Box mt={0.5}>
            <Chip label={sheetLabel} size="small" variant="outlined" sx={{ mr: 0.5 }} />
          </Box>
        </Box>
        <IconButton
          size="small"
          onClick={handleClose}
          aria-label="Close"
          sx={{ mt: 0.5, width: 44, height: 44, flexShrink: 0 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent>
        {/* Guard: batch may briefly be null during close animation */}
        {batch && (
          <>
            {/* Schedule validity warning */}
            {!batch.scheduleValid && batch.scheduleName && (
              <Alert severity="warning" sx={{ mb: 2, fontSize: '0.82rem' }}>
                Schedule name <strong>"{batch.scheduleName}"</strong> is not in the
                approved list. This row was loaded from Excel as-is.
              </Alert>
            )}

            {/* Batch metadata */}
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>
              Details
            </Typography>
            <Grid container spacing={1} sx={{ mb: 3 }}>
              <InfoRow label={COLUMN_LABELS.batchName}    value={batch.batchName} />
              <InfoRow label={COLUMN_LABELS.scheduleName} value={batch.scheduleName} />
              <InfoRow label={COLUMN_LABELS.arguments}    value={batch.arguments || '(none)'} />
              <InfoRow label={COLUMN_LABELS.sheetSource}  value={sheetLabel} />
              <InfoRow label={COLUMN_LABELS.logDir}       value={batch.logDir} />
            </Grid>

            <Divider sx={{ mb: 2 }} />

            {/* Run / Resume commands */}
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>
              Run / Resume Commands
            </Typography>
            <CommandViewer batch={batch} />
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} size="small">Close</Button>
      </DialogActions>
    </Dialog>
  );
});
