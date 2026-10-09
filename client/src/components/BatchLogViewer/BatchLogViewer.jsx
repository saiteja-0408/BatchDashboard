/**
 * BatchLogViewer.jsx — fetches and displays remote batch log files.
 *
 * Rendered inside BatchDetailModal below the CommandViewer.
 *
 * Two buttons:
 *   "Get Logs"        — fetches today's dated log:  <BatchName><MM-DD-YYYY>.log
 *   "Get Error Logs"  — fetches the Bus Error log:  *<BatchName>*_Bus_Error.log
 *
 * Both share a single log output panel below.  Clicking either button replaces
 * the previous result, with a label showing which log type is currently displayed.
 *
 * States per button:
 *   idle     → button enabled, no output shown
 *   loading  → spinner on the clicked button, both buttons disabled
 *   success  → log content shown in scrollable <pre> with "Copy All"
 *   error    → red alert with message, both buttons re-enabled for retry
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Box, Button, Typography, CircularProgress, Alert,
  Collapse, Divider, Chip, Tooltip,
} from '@mui/material';
import ArticleIcon        from '@mui/icons-material/Assessment';
import ErrorOutlineIcon   from '@mui/icons-material/RemoveCircleOutline';
import ContentCopyIcon    from '@mui/icons-material/ContentCopy';
import CheckIcon          from '@mui/icons-material/Check';
import DownloadIcon       from '@mui/icons-material/GetApp';
import { fetchBatchLogs, fetchBatchErrorLogs } from '../../services/apiService';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds today's date string in MM-DD-YYYY format — mirrors todayMMDDYYYY()
 * in server/services/sshService.js so the downloaded filename matches the
 * actual file name on the remote server exactly.
 * @returns {string}  e.g. "10-09-2026"
 */
function todayMMDDYYYY() {
  const d  = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}-${d.getFullYear()}`;
}

/**
 * Returns the filename the log would have on the remote server.
 *
 * Today's log  →  <batchName><MM-DD-YYYY>.log
 *   e.g. BatchGetDd214Response10-09-2026.log
 *
 * Bus Error log →  <scheduleName>_<batchName>_Bus_Error.log
 *                  (or <batchName>_Bus_Error.log when scheduleName is absent)
 *   e.g. benefits_icon_import_12pm_BatchGetDd214Response_Bus_Error.log
 *
 * @param {'today'|'error'} logType
 * @param {string} batchName
 * @param {string} [scheduleName]
 * @returns {string}
 */
function buildLogFileName(logType, batchName, scheduleName) {
  if (logType === 'error') {
    return scheduleName
      ? `${scheduleName}_${batchName}_Bus_Error.log`
      : `${batchName}_Bus_Error.log`;
  }
  return `${batchName}${todayMMDDYYYY()}.log`;
}

/**
 * Triggers a browser file download of `text` with the given `filename`.
 * Uses a temporary anchor element — no server round-trip needed.
 * @param {string} text
 * @param {string} filename
 */
function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Log output panel ──────────────────────────────────────────────────────────

const LogPanel = React.memo(function LogPanel({ content, logTypeLabel, fileName }) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <Box sx={{ mt: 1 }}>
      {/* Header row: which log is showing + action buttons */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Chip
          label={logTypeLabel}
          size="small"
          variant="outlined"
          color="default"
          sx={{ fontSize: '0.72rem' }}
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* Download button */}
          <Tooltip title={`Download as ${fileName}`}>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<DownloadIcon />}
              onClick={() => downloadTextFile(content, fileName)}
              sx={{ minWidth: 110 }}
            >
              Download
            </Button>
          </Tooltip>

          {/* Copy All button */}
          <Tooltip title={copied ? 'Copied!' : 'Copy all'}>
            <Button
              size="small"
              variant="outlined"
              startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
              onClick={() => copy(content)}
              sx={{ minWidth: 100 }}
            >
              {copied ? 'Copied' : 'Copy All'}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Scrollable log body */}
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          maxHeight: 420,
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
  content:      PropTypes.string.isRequired,
  logTypeLabel: PropTypes.string.isRequired,
  fileName:     PropTypes.string.isRequired,
};

// ── BatchLogViewer ────────────────────────────────────────────────────────────

/**
 * @param {{ batch: Object }} props
 */
export const BatchLogViewer = React.memo(function BatchLogViewer({ batch }) {
  // 'idle' | 'loading-today' | 'loading-error' | 'success' | 'error'
  const [status,       setStatus]       = useState('idle');
  const [logText,      setLogText]      = useState('');
  const [errMsg,       setErrMsg]       = useState('');
  const [activeLogType, setActiveLogType] = useState('');  // 'today' | 'error'

  const abortRef = useRef(null);

  // Reset when batch changes (new modal open)
  useEffect(() => {
    setStatus('idle');
    setLogText('');
    setErrMsg('');
    setActiveLogType('');
    abortRef.current?.abort();
  }, [batch?.batchName]);

  const handleFetch = useCallback(async (logType) => {
    if (!batch) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setStatus(logType === 'error' ? 'loading-error' : 'loading-today');
    setLogText('');
    setErrMsg('');
    setActiveLogType(logType);

    try {
      const text = logType === 'error'
        ? await fetchBatchErrorLogs(batch.batchName, batch.sheetSource)
        : await fetchBatchLogs(batch.batchName, batch.sheetSource);

      setLogText(text);
      setStatus('success');
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setErrMsg(err.message || 'Failed to fetch logs.');
      setStatus('error');
    }
  }, [batch]);

  if (!batch) return null;

  const isLoadingToday = status === 'loading-today';
  const isLoadingError = status === 'loading-error';
  const isLoading      = isLoadingToday || isLoadingError;
  const hasResult      = status === 'success';
  const hasError       = status === 'error';

  const isInfoMessage = activeLogType === 'error' && (
    logText === 'No business error files avaialble for today' ||
    logText === 'No Business Error Logs found for today'
  );

  const logTypeLabel = activeLogType === 'error'
    ? 'Bus Error Log'
    : "Today's Log";

  // Filename mirrors the actual file on the remote server (see sshService.js)
  const logFileName = buildLogFileName(activeLogType, batch.batchName, batch.scheduleName);

  return (
    <Box>
      <Divider sx={{ my: 2 }} />

      {/* Section title */}
      <Typography
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 1.25 }}
      >
        Remote Logs
      </Typography>

      {/* Two action buttons side by side */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>

        {/* Get Logs — today's dated .log file */}
        <Button
          size="small"
          variant="contained"
          startIcon={
            isLoadingToday
              ? <CircularProgress size={14} color="inherit" />
              : <ArticleIcon fontSize="small" />
          }
          onClick={() => handleFetch('today')}
          disabled={isLoading}
          sx={{ minWidth: 110 }}
        >
          {isLoadingToday ? 'Fetching…' : 'Get Logs'}
        </Button>

        {/* Get Error Logs — *BatchName*_Bus_Error.log */}
        <Button
          size="small"
          variant="outlined"
          color="error"
          startIcon={
            isLoadingError
              ? <CircularProgress size={14} color="inherit" />
              : <ErrorOutlineIcon fontSize="small" />
          }
          onClick={() => handleFetch('error')}
          disabled={isLoading}
          sx={{ minWidth: 140 }}
        >
          {isLoadingError ? 'Fetching…' : 'Get Biz Error Logs'}
        </Button>

      </Box>

      {/* Error alert */}
      <Collapse in={hasError}>
        <Alert
          severity="error"
          sx={{ mt: 1.5 }}
          onClose={() => setStatus('idle')}
        >
          {errMsg}
        </Alert>
      </Collapse>

      {/* Info message alert (styled as neutral info instead of code block or error) */}
      <Collapse in={hasResult && isInfoMessage}>
        <Alert
          severity="info"
          sx={{ mt: 1.5 }}
        >
          {logText}
        </Alert>
      </Collapse>

      {/* Log output */}
      <Collapse in={hasResult && !isInfoMessage}>
        <LogPanel content={logText} logTypeLabel={logTypeLabel} fileName={logFileName} />
      </Collapse>

      {/* Idle hint */}
      {status === 'idle' && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          "Get Logs" fetches today's log · "Get Biz Error Logs" fetches the Bus Error log.
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
