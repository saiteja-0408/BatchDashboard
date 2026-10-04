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
import { buildQclientLine, LOG_PATH_DEFS } from '../../utils/constants';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

// ── CommandBlock ──────────────────────────────────────────────────────────────

/**
 * Single copy-paste block — value body with a floating copy button.
 * No label is shown; the enclosing Section title provides context.
 */
const CommandBlock = React.memo(function CommandBlock({ value }) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/* Copy button — floats top-right over the value area */}
      <Tooltip title={copied ? 'Copied!' : 'Copy'}>
        <IconButton
          size="small"
          onClick={() => copy(value)}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            bgcolor: 'background.paper',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {copied
            ? <CheckIcon fontSize="small" color="success" />
            : <ContentCopyIcon fontSize="small" />}
        </IconButton>
      </Tooltip>

      {/* Value body */}
      <Box
        component="pre"
        sx={{
          m: 0,
          px: 1.5, py: 1.25,
          pr: 5,  // leave room for the floating copy button
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
  value: PropTypes.string.isRequired,
};

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <Box>
      <Typography
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 0.75 }}
      >
        {title}
      </Typography>
      <Stack spacing={1}>
        {children}
      </Stack>
    </Box>
  );
}
Section.propTypes = {
  title:    PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

// ── CommandViewer ─────────────────────────────────────────────────────────────

/**
 * @param {{ batch: Object }} props
 */
export const CommandViewer = React.memo(function CommandViewer({ batch }) {
  if (!batch) return null;

  const domain = batch.sheetSource; // 'benefits' | 'tax'
  const logDefs = LOG_PATH_DEFS[domain] ?? [];

  return (
    <Stack spacing={0} divider={<Divider sx={{ my: 2 }} />}>

      {/* ── Missing Schedule Alert ── */}
      {!batch.scheduleName && (
        <Alert severity="error" sx={{ fontSize: '0.82rem' }}>
          No schedule name found for this batch — commands cannot be constructed.
        </Alert>
      )}

      {/* ── Change Directory ── */}
      <Section title="Change Directory">
        <CommandBlock value={batch.logDir} />
      </Section>

      {/* ── Run Command ── */}
      <Section title="Run Command">
        <CommandBlock value={buildQclientLine(batch, 'runJobOnly')} />
      </Section>

      {/* ── Resume Command ── */}
      <Section title="Resume Command">
        <CommandBlock value={buildQclientLine(batch, 'resumeJob')} />
      </Section>

      {/* ── Log Paths ── */}
      <Section title="Log Paths">
        {logDefs.map(({ label, path }) => (
          <CommandBlock
            key={label}
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
  }),
};
