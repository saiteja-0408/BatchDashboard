/**
 * CommandViewer.jsx — copy-paste panel for a selected batch.
 *
 * Sections rendered:
 *   - Log Paths  — domain-filtered paths with batch name substituted
 *
 * Removed sections (per requirements):
 *   - Change Directory (cd command)
 *   - Run Command
 *   - Resume Command
 *   - Benefits logs entry (entire block removed)
 *   - Benefits logs archive label (label hidden; copy button + path retained)
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Box, Typography, Tooltip, IconButton, Stack, Alert,
} from '@mui/material';
import ContentCopyIcon  from '@mui/icons-material/ContentCopy';
import CheckIcon        from '@mui/icons-material/Check';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { LOG_PATH_DEFS, VALID_SCHEDULE_NAMES } from '../../utils/constants';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

// ── CommandBlock ──────────────────────────────────────────────────────────────

/**
 * Single copy-paste block.
 *
 * Props:
 *   label      — heading text shown in the header bar
 *   showLabel  — when false the label Typography is hidden; copy button remains
 *   sublabel   — optional smaller descriptor beside the label
 *   value      — the text to display in the body and copy to clipboard
 */
const CommandBlock = React.memo(function CommandBlock({ label, showLabel = true, sublabel, value }) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <Box
      sx={{
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          px: 1.5, py: 0.75,
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
          {showLabel && (
            <Typography variant="body2" fontWeight={700} noWrap>
              {label}
            </Typography>
          )}
          {sublabel && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {sublabel}
            </Typography>
          )}
        </Box>
        <Tooltip title={copied ? 'Copied!' : 'Copy'}>
          <IconButton size="small" onClick={() => copy(value)} sx={{ flexShrink: 0 }}>
            {copied
              ? <CheckIcon fontSize="small" color="success" />
              : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Value body */}
      <Box
        component="pre"
        sx={{
          m: 0,
          px: 1.5, py: 1.25,
          fontSize: 'clamp(0.72rem, 1.5vw, 0.82rem)',
          fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          bgcolor: 'background.default',
          color: 'text.primary',
          lineHeight: 1.7,
        }}
      >
        {value}
      </Box>
    </Box>
  );
});
CommandBlock.propTypes = {
  label:     PropTypes.string.isRequired,
  showLabel: PropTypes.bool,
  sublabel:  PropTypes.string,
  value:     PropTypes.string.isRequired,
};

// ── Labels to skip or hide within the Log Paths section ──────────────────────

/** Entire CommandBlock is omitted for these labels. */
const SKIP_LOG_LABELS = new Set(['Benefits logs']);

/** Label Typography is hidden (copy button + path body retained) for these. */
const HIDE_LABEL_LOG_LABELS = new Set(['Benefits logs archive']);

// ── CommandViewer ─────────────────────────────────────────────────────────────

/**
 * @param {{ batch: Object }} props
 */
export const CommandViewer = React.memo(function CommandViewer({ batch }) {
  if (!batch) return null;

  const scheduleIsValid = VALID_SCHEDULE_NAMES.has(batch.scheduleName);
  const domain  = batch.sheetSource; // 'benefits' | 'tax'
  const logDefs = LOG_PATH_DEFS[domain] ?? [];

  // Filter and annotate log entries per the removal rules above
  const visibleLogDefs = logDefs.filter(({ label }) => !SKIP_LOG_LABELS.has(label));

  return (
    <Stack spacing={2}>

      {/* ── Warnings ── */}
      {!batch.scheduleName && (
        <Alert severity="error" sx={{ fontSize: '0.82rem' }}>
          No schedule name found for this batch — commands cannot be constructed.
        </Alert>
      )}
      {!scheduleIsValid && batch.scheduleName && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon fontSize="inherit" />}
          sx={{ fontSize: '0.82rem' }}
        >
          Schedule <strong>"{batch.scheduleName}"</strong> is not in the approved list.
          Verify before running.
        </Alert>
      )}

      {/* ── Log Paths ── */}
      <Stack spacing={1}>
        {visibleLogDefs.map(({ label, path }) => (
          <CommandBlock
            key={label}
            label={label}
            showLabel={!HIDE_LABEL_LOG_LABELS.has(label)}
            value={path(batch.batchName)}
          />
        ))}
        {visibleLogDefs.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            No log paths defined for domain "{domain}".
          </Typography>
        )}
      </Stack>

    </Stack>
  );
});

CommandViewer.propTypes = {
  batch: PropTypes.shape({
    batchName:     PropTypes.string,
    scheduleName:  PropTypes.string,
    arguments:     PropTypes.string,
    logDir:        PropTypes.string,
    sheetSource:   PropTypes.string,
    scheduleValid: PropTypes.bool,
  }),
};
