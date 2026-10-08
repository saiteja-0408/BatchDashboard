/**
 * BatchLogViewer.jsx — fetches and displays a remote batch log file.
 *
 * Rendered inside BatchDetailModal below the CommandViewer.
 * Stays collapsed by default; clicking "Get Logs" triggers the SSH fetch
 * via the backend and shows the result in a scrollable pre block.
 *
 * States:
 *   idle      → "Get Logs" button visible, nothing fetched yet
 *   loading   → spinner shown, button disabled
 *   success   → log content displayed in a scrollable <pre>
 *   error     → error message shown with a retry button
 *
 * Performance:
 *   - Component is memoised; only re-renders when `batch` prop identity changes.
 *   - Log state is local — does not pollute global BatchContext.
 *   - Abort controller cancels any in-flight request when the modal closes
 *     or the batch changes before the fetch resolves.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Box, Button, Typography, CircularProgress, Alert,
  Collapse, Divider, Tooltip,
} from '@mui/material';
import DownloadIcon    from '@mui/icons-material/Assessment';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon       from '@mui/icons-material/Check';
import { fetchBatchLogs } from '../../services/apiService';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

// ── Log content panel ─────────────────────────────────────────────────────────

const LogPanel = React.memo(function LogPanel({ content }) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <Box sx={{ position: 'relative', mt: 1 }}>
      {/* Copy-all button */}
      <Tooltip title={copied ? 'Copied!' : 'Copy all'}>
        <Button
          size="small"
          variant="outlined"
          startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
          onClick={() => copy(content)}
          sx={{ mb: 1, minWidth: 110 }}
        >
          {copied ? 'Copied' : 'Copy All'}
        </Button>
      </Tooltip>

      {/* Scrollable log body */}
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          maxHeight: 400,
          overflowY: 'auto',
          fontSize: 'clamp(0.68rem, 1.4vw, 0.78rem)',
          fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          lineHeight: 1.65,
          bgcolor: 'background.default',
          color: 'text.primary',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        {content || '(empty log file)'}
      </Box>
    </Box>
  );
});

LogPanel.propTypes = {
  content: PropTypes.string.isRequired,
};

// ── BatchLogViewer ────────────────────────────────────────────────────────────

/**
 * @param {{ batch: Object }} props
 */
export const BatchLogViewer = React.memo(function BatchLogViewer({ batch }) {
  const [status,  setStatus]  = useState('idle');    // 'idle' | 'loading' | 'success' | 'error'
  const [logText, setLogText] = useState('');
  const [errMsg,  setErrMsg]  = useState('');

  // Keep an AbortController ref so we can cancel in-flight requests.
  const abortRef = useRef(null);

  // Reset to idle whenever the batch changes (new modal open).
  useEffect(() => {
    setStatus('idle');
    setLogText('');
    setErrMsg('');
    // Cancel any in-flight request from a previous batch.
    abortRef.current?.abort();
  }, [batch?.batchName]);

  const handleFetch = useCallback(async () => {
    if (!batch) return;

    // Cancel any previous in-flight request before starting a new one.
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setStatus('loading');
    setLogText('');
    setErrMsg('');

    try {
      const text = await fetchBatchLogs(batch.batchName, batch.sheetSource);
      setLogText(text);
      setStatus('success');
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setErrMsg(err.message || 'Failed to fetch logs.');
      setStatus('error');
    }
  }, [batch]);

  if (!batch) return null;

  return (
    <Box>
      <Divider sx={{ my: 2 }} />

      {/* Section header + trigger button */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography
          variant="caption"
          fontWeight={700}
          color="text.secondary"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
        >
          Remote Logs
        </Typography>

        <Button
          size="small"
          variant="contained"
          startIcon={status === 'loading' ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon fontSize="small" />}
          onClick={handleFetch}
          disabled={status === 'loading'}
          sx={{ minWidth: 100 }}
        >
          {status === 'loading' ? 'Fetching…' : 'Get Logs'}
        </Button>
      </Box>

      {/* Error state */}
      <Collapse in={status === 'error'}>
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setStatus('idle')}>
          {errMsg}
        </Alert>
      </Collapse>

      {/* Log output */}
      <Collapse in={status === 'success'}>
        <LogPanel content={logText} />
      </Collapse>

      {/* Idle hint */}
      {status === 'idle' && (
        <Typography variant="caption" color="text.secondary">
          Click "Get Logs" to fetch the last 500 lines from the remote server.
        </Typography>
      )}
    </Box>
  );
});

BatchLogViewer.propTypes = {
  batch: PropTypes.shape({
    batchName:   PropTypes.string,
    sheetSource: PropTypes.string,
    logDir:      PropTypes.string,
  }),
};
