/**
 * EmailPreviewModal.jsx — renders a faithful preview of the status report email
 * before dispatching, matching the exact format shown in Screenshots 2–4.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  IconButton,
  CircularProgress,
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onSend: () => void,
 *   previewHtml: string,
 *   emailConfig: Object,
 *   isSending: boolean,
 * }} props
 */
export function EmailPreviewModal({
  open,
  onClose,
  onSend,
  previewHtml,
  emailConfig,
  isSending = false,
}) {
  const titleId = 'email-preview-modal-title';

  return (
    <Dialog
      open={open}
      onClose={isSending ? undefined : onClose}
      aria-labelledby={titleId}
      fullWidth
      maxWidth="md"
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '92vh',
        },
      }}
    >
      {/* ── Header ── */}
      <DialogTitle
        id={titleId}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 1.5,
        }}
      >
        <Typography variant="h6" fontWeight={700} component="span">
          Email Preview
        </Typography>
        <IconButton
          aria-label="Close preview"
          onClick={onClose}
          disabled={isSending}
          size="small"
          edge="end"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* ── Metadata Banner (From / To / CC / Subject) ── */}
      <Box
        sx={{
          px: 3,
          py: 1.5,
          bgcolor: 'background.default',
          borderBottom: '1px solid',
          borderColor: 'divider',
          fontSize: '0.82rem',
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'center' }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">From:</Typography>
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            {emailConfig?.from || 'rabatthula@mdes.ms.gov'}
          </Typography>

          <Typography variant="caption" fontWeight={700} color="text.secondary">To:</Typography>
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            {emailConfig?.to || 'team@mdes.ms.gov'}
          </Typography>

          {emailConfig?.cc && (
            <>
              <Typography variant="caption" fontWeight={700} color="text.secondary">CC:</Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                {emailConfig.cc}
              </Typography>
            </>
          )}

          <Typography variant="caption" fontWeight={700} color="text.secondary">Subject:</Typography>
          <Typography variant="caption" fontWeight={600}>
            {emailConfig?.subject || `MS Daily Health Check — ${new Date().toLocaleDateString('en-US')}`}
          </Typography>
        </Box>
      </Box>

      {/* ── Preview Body ── */}
      <DialogContent sx={{ p: 2, bgcolor: '#f4f6f8' }}>
        <Paper
          elevation={1}
          sx={{
            p: 3,
            bgcolor: '#ffffff',
            color: '#000000',
            borderRadius: 1,
            overflowX: 'auto',
          }}
        >
          {previewHtml ? (
            <div
              dangerouslySetInnerHTML={{ __html: previewHtml }}
              style={{ fontFamily: 'Calibri, Arial, sans-serif' }}
            />
          ) : (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary" mt={1}>
                Generating email preview…
              </Typography>
            </Box>
          )}
        </Paper>
      </DialogContent>

      {/* ── Footer Actions ── */}
      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          gap: 1,
          justifyContent: 'space-between',
        }}
      >
        <Button
          variant="outlined"
          color="inherit"
          onClick={onClose}
          disabled={isSending}
          startIcon={<ArrowBackIcon fontSize="small" />}
        >
          Back to Edit
        </Button>

        <Button
          variant="contained"
          color="primary"
          onClick={onSend}
          disabled={isSending}
          startIcon={
            isSending
              ? <CircularProgress size={16} color="inherit" />
              : <SendIcon fontSize="small" />
          }
        >
          {isSending ? 'Sending…' : 'Send Email'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

EmailPreviewModal.propTypes = {
  open:        PropTypes.bool.isRequired,
  onClose:     PropTypes.func.isRequired,
  onSend:      PropTypes.func.isRequired,
  previewHtml: PropTypes.string,
  emailConfig: PropTypes.object,
  isSending:   PropTypes.bool,
};
