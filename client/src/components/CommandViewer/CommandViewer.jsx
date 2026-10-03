/**
 * CommandViewer.jsx — 4-section copy-paste panel for a selected batch.
 *
 * Sections:
 *   1. Change Directory  — domain-specific cd command from batch.logDir
 *   2. Run Command       — sudo ./qclient.sh runJobOnly …
 *   3. Resume Command    — sudo ./qclient.sh resumeJob …
 *   4. Log Paths         — domain-filtered paths with batch name substituted
 *
 * Each section renders as a labelled CommandBlock with a one-click copy button.
 * No static placeholder text — batch name is always substituted at render time.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Box, Typography, Tooltip, IconButton, Stack, Alert, Divider,
} from '@mui/material';
import ContentCopyIcon  from '@mui/icons-material/ContentCopy';
import CheckIcon        from '@mui/icons-material/Check';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { buildQclientLine, LOG_PATH_DEFS, VALID_SCHEDULE_NAMES } from '../../utils/constants';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

// ── CommandBlock ──────────────────────────────────────────────────────────────

/**
 * Single labelled copy-paste block.
 * label      — section heading text (e.g. "Change Directory")
 * sublabel   — optional smaller descriptor shown next to the label
 * value      — the text to display and copy
 */
const CommandBlock = React.memo(function CommandBlock({ label, sublabel, value }) {
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
          <Typography variant="body2" fontWeight={700} noWrap>
            {label}
          </Typography>
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
  label:    PropTypes.string.isRequired,
  sublabel: PropTypes.string,
  value:    PropTypes.string.isRequired,
};

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ number, title, children }) {
  return (
    <Box>
      <Typography
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 0.75 }}
      >
        Option {number} — {title}
      </Typography>
      <Stack spacing={1}>
        {children}
      </Stack>
    </Box>
  );
}
Section.propTypes = {
  number:   PropTypes.number.isRequired,
  title:    PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

// ── CommandViewer ─────────────────────────────────────────────────────────────

/**
 * @param {{ batch: Object }} props
 */
export const CommandViewer = React.memo(function CommandViewer({ batch }) {
  if (!batch) return null;

  const scheduleIsValid = VALID_SCHEDULE_NAMES.has(batch.scheduleName);
  const domain = batch.sheetSource; // 'benefits' | 'tax'
  const logDefs = LOG_PATH_DEFS[domain] ?? [];

  return (
    <Stack spacing={0} divider={<Divider sx={{ my: 2 }} />}>

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

      {/* ── Option 1: Change Directory ── */}
      <Section number={1} title="Change Directory">
        <CommandBlock
          label="cd"
          value={batch.logDir}
        />
      </Section>

      {/* ── Option 2: Run Command ── */}
      <Section number={2} title="Run Command">
        <CommandBlock
          label="Run"
          value={buildQclientLine(batch, 'runJobOnly')}
        />
      </Section>

      {/* ── Option 3: Resume Command ── */}
      <Section number={3} title="Resume Command">
        <CommandBlock
          label="Resume"
          value={buildQclientLine(batch, 'resumeJob')}
        />
      </Section>

      {/* ── Option 4: Log Paths ── */}
      <Section number={4} title="Log Paths">
        {logDefs.map(({ label, path }) => (
          <CommandBlock
            key={label}
            label={label}
            value={path(batch.batchName)}
          />
        ))}
        {logDefs.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            No log paths defined for domain "{domain}".
          </Typography>
        )}
      </Section>

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
