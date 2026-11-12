/**
 * EmailPreviewModal.jsx — renders a faithful preview of the status report email
 * before dispatching, matching the exact format shown in Screenshots 2–4.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Paper,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import DraftsIcon from '@mui/icons-material/Drafts';

/**
 * Generates an RFC 822 .eml draft message with X-Unsent: 1 header.
 * When opened, Microsoft Outlook immediately opens a pre-populated Draft window.
 *
 * @param {Object} params
 * @param {string} params.from
 * @param {string} params.to
 * @param {string} [params.cc]
 * @param {string} params.subject
 * @param {string} params.htmlBody
 * @returns {string}
 */
function buildEmlMessage({ from, to, cc, subject, htmlBody }) {
  const headers = [
    'X-Unsent: 1',
    to ? `To: ${to}` : '',
    cc ? `Cc: ${cc}` : '',
    from ? `From: ${from}` : '',
    `Subject: ${subject || 'MS Daily Health Check Verification Status Report'}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
  ].filter(Boolean).join('\r\n');

  return `${headers}\r\n\r\n${htmlBody || ''}`;
}

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
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const handleCopyFormattedEmail = async () => {
    if (!previewHtml) return;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const htmlBlob = new Blob([previewHtml], { type: 'text/html' });
        const textBlob = new Blob([previewHtml.replace(/<[^>]+>/g, ' ')], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(previewHtml);
      }
      setCopied(true);
      setToastMessage('Formatted email copied to clipboard! Paste directly into Outlook with Ctrl+V.');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy email:', err);
      setToastMessage('Failed to copy email to clipboard.');
    }
  };

  const handleOpenInOutlook = () => {
    if (!previewHtml) return;
    try {
      const emlContent = buildEmlMessage({
        from:    emailConfig?.from || 'rabatthula@mdes.ms.gov',
        to:      emailConfig?.to || 'team@mdes.ms.gov',
        cc:      emailConfig?.cc || '',
        subject: emailConfig?.subject || `[MS Daily Health Check] Verification Status Report — ${new Date().toLocaleDateString('en-US')}`,
        htmlBody: previewHtml,
      });

      const blob = new Blob([emlContent], { type: 'message/rfc822;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      anchor.download = `HealthCheck_StatusReport_${dateStr}.eml`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setToastMessage('Outlook draft (.eml) downloaded! Open this file to launch Outlook with everything pre-filled.');
    } catch (err) {
      console.error('Failed to export Outlook draft:', err);
      setToastMessage('Failed to generate Outlook draft file.');
    }
  };

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
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          justifyContent: 'space-between',
          alignItems: 'center',
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

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Copy styled table and signature to paste directly into Outlook compose window">
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleCopyFormattedEmail}
              disabled={isSending || !previewHtml}
              startIcon={copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
            >
              {copied ? 'Copied!' : 'Copy for Outlook'}
            </Button>
          </Tooltip>

          <Tooltip title="Downloads a ready-to-send Outlook draft (.eml). Opening it launches Outlook with all recipients, subject, and report body pre-filled.">
            <Button
              variant="contained"
              color="info"
              onClick={handleOpenInOutlook}
              disabled={isSending || !previewHtml}
              startIcon={<DraftsIcon fontSize="small" />}
              sx={{ fontWeight: 600 }}
            >
              Open in Outlook (.eml)
            </Button>
          </Tooltip>

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
            {isSending ? 'Sending…' : 'Send via SMTP'}
          </Button>
        </Box>
      </DialogActions>

      {/* ── Notification Toast ── */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={6000}
        onClose={() => setToastMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToastMessage('')}
          severity="success"
          variant="filled"
          sx={{ width: '100%', boxShadow: 3 }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
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
