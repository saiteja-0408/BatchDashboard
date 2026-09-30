/**
 * BatchDetailModal.jsx — full detail modal for a selected batch.
 *
 * Shows batch metadata + Run/Resume commands.
 * Displays a schedule name warning badge when the schedule is not in the approved list.
 */

import React from 'react';
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
import { useBatchContext } from '../../context/BatchContext';

function InfoRow({ label, value }) {
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
}
InfoRow.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export function BatchDetailModal() {
  const { selectedBatch: batch, isModalOpen, closeBatchModal } = useBatchContext();

  const handleClose = () => {
    closeBatchModal();
  };

  if (!batch) return null;

  const sheetLabel = SHEET_LABELS[batch.sheetSource] || batch.sheetSource || '—';

  return (
    <Dialog
      open={isModalOpen}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      scroll="paper"
    >
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pb: 1 }}
      >
        <Box sx={{ flex: 1, mr: 1 }}>
          <Typography variant="h6" component="span" sx={{ wordBreak: 'break-word' }}>
            {batch.batchName}
          </Typography>
          {/* Schedule warning badge in title area */}
          {!batch.scheduleValid && batch.scheduleName && (
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
        <IconButton size="small" onClick={handleClose} sx={{ mt: 0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent>
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
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} size="small">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
