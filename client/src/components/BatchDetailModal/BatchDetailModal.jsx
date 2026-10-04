/**
 * BatchDetailModal.jsx — copy-paste command panel for a selected batch.
 *
 * Shows 4 sections: Change Directory, Run Command, Resume Command, Log Paths.
 * All batch detail fields (Batch Name, Schedule, Arguments, Sheet, Log Dir)
 * have been removed — the title and sheet chip provide sufficient context.
 *
 * Performance:
 *   - Subscribes to BatchModalContext (useBatchModal) NOT BatchDataContext so it
 *     is the ONLY component that re-renders when a row is clicked.
 *   - Dialog is always mounted — open prop flips between true/false instead of
 *     the entire subtree unmounting/remounting on every open.
 *   - transitionDuration reduced to 120ms enter / 80ms exit for snappier feel.
 *   - handleClose is stable (useCallback).
 */

import React, { useCallback, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Chip, Divider,
  IconButton,
} from '@mui/material';
import CloseIcon        from '@mui/icons-material/Close';
import { CommandViewer } from '../CommandViewer/CommandViewer';
import { SHEET_LABELS }  from '../../utils/constants';
import { useBatchModal } from '../../context/BatchContext';

export const BatchDetailModal = React.memo(function BatchDetailModal() {
  const { selectedBatch: batch, isModalOpen, closeBatchModal } = useBatchModal();

  const handleClose = useCallback(() => closeBatchModal(), [closeBatchModal]);

  // Derive sheetLabel once per batch change.
  // Falls back to the previous value while the close animation plays
  // (batch is only cleared 300ms after close so the label stays visible).
  const sheetLabel = useMemo(
    () => (batch ? (SHEET_LABELS[batch.sheetSource] || batch.sheetSource || '—') : ''),
    [batch]
  );

  return (
    <Dialog
      open={isModalOpen}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      transitionDuration={{ enter: 120, exit: 80 }}
      sx={{
        '& .MuiDialog-paper': {
          m: { xs: 1, sm: 2 },
          maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 32px)' },
          width: { xs: 'calc(100% - 16px)', sm: undefined },
          maxWidth: { xl: '780px', xl2: '900px' },
        },
      }}
    >
      {/* Title row: batch name + sheet chip + close button */}
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pb: 1 }}
      >
        <Box sx={{ flex: 1, mr: 1 }}>
          <Typography variant="h6" component="span" sx={{ wordBreak: 'break-word' }}>
            {batch?.batchName}
          </Typography>
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
        {batch && (
          <CommandViewer batch={batch} />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} size="small">Close</Button>
      </DialogActions>
    </Dialog>
  );
});
