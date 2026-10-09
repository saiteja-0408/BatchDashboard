/**
 * CommandViewer.jsx — 4-section copy-paste panel for a selected batch.
 *
 * Sections:
 *   1. Change Directory  — domain-specific cd command from batch.logDir
 *   2. Run Command       — sudo ./qclient.sh runJobOnly …
 *   3. Resume Command    — sudo ./qclient.sh resumeJob …
 *   4. Log Paths         — domain-filtered paths with batch name substituted
 *
 * When VITE_ENABLE_SSH_RUN_COMMAND=true a "Run" button is shown next to the
 * Run Command and Resume Command blocks.  Clicking the button executes the
 * command on the remote batch server via SSH and displays the output (or an
 * error) in a collapsible panel beneath the respective section.
 *
 * Each section renders as a labelled CommandBlock with a one-click copy button.
 * No static placeholder text — batch name is always substituted at render time.
 */

import React, { useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box, Typography, Tooltip, IconButton, Stack, Alert, Divider,
  Button, CircularProgress, Collapse, Chip,
} from '@mui/material';
import ContentCopyIcon  from '@mui/icons-material/ContentCopy';
import CheckIcon        from '@mui/icons-material/Check';
import PlayArrowIcon    from '@mui/icons-material/Schedule';  // reuse existing import
import { buildQclientLine, LOG_PATH_DEFS } from '../../utils/constants';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { useRunCommand }      from '../../hooks/useRunCommand';

// Feature flag — read once at module load (Vite replaces import.meta.env at build time)
const SSH_RUN_ENABLED =
  import.meta.env.VITE_ENABLE_SSH_RUN_COMMAND === 'true' ||
  import.meta.env.VITE_ENABLE_SSH_RUN_COMMAND === true;

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

// ── RunOutputPanel ────────────────────────────────────────────────────────────

/**
 * Collapsible panel shown below a Run/Resume Command block after execution.
 * Displays success output or an error message.
 */
const RunOutputPanel = React.memo(function RunOutputPanel({
  status, output, errMsg, exitCode, onDismiss,
}) {
  const isSuccess = status === 'success';
  const isError   = status === 'error';

  return (
    <>
      {/* Success */}
      <Collapse in={isSuccess}>
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography
              variant="caption"
              fontWeight={700}
              color="success.main"
              sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Command executed successfully
            </Typography>
            {exitCode !== null && (
              <Chip label={`exit ${exitCode}`} size="small" color="success" variant="outlined" sx={{ fontSize: '0.68rem' }} />
            )}
          </Box>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.25,
              maxHeight: 320,
              overflowY: 'auto',
              fontSize: 'clamp(0.68rem, 1.4vw, 0.78rem)',
              fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: 1.65,
              bgcolor: 'background.default',
              color: 'text.primary',
              border: '1px solid',
              borderColor: 'success.light',
              borderRadius: 1,
            }}
          >
            {output || '(no output)'}
          </Box>
          <Button
            size="small"
            variant="text"
            onClick={onDismiss}
            sx={{ mt: 0.5, fontSize: '0.72rem', color: 'text.secondary' }}
          >
            Dismiss
          </Button>
        </Box>
      </Collapse>

      {/* Error */}
      <Collapse in={isError}>
        <Alert
          severity="error"
          sx={{ mt: 1 }}
          onClose={onDismiss}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: output ? 0.5 : 0 }}>
            {errMsg}
          </Typography>
          {output && (
            <Box
              component="pre"
              sx={{
                m: 0,
                mt: 0.5,
                fontSize: '0.72rem',
                fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {output}
            </Box>
          )}
        </Alert>
      </Collapse>
    </>
  );
});

RunOutputPanel.propTypes = {
  status:    PropTypes.string.isRequired,
  output:    PropTypes.string.isRequired,
  errMsg:    PropTypes.string.isRequired,
  exitCode:  PropTypes.number,
  onDismiss: PropTypes.func.isRequired,
};

// ── RunButton ─────────────────────────────────────────────────────────────────

/**
 * Thin wrapper: a small "Run" button that triggers SSH execution.
 * Hidden when SSH_RUN_ENABLED is false.
 */
const RunButton = React.memo(function RunButton({ onClick, isLoading }) {
  if (!SSH_RUN_ENABLED) return null;

  return (
    <Tooltip title="Execute this command on the remote batch server via SSH">
      <span>
        <Button
          size="small"
          variant="outlined"
          color="warning"
          startIcon={
            isLoading
              ? <CircularProgress size={13} color="inherit" />
              : <PlayArrowIcon fontSize="small" />
          }
          onClick={onClick}
          disabled={isLoading}
          sx={{ minWidth: 72, height: 32 }}
        >
          {isLoading ? 'Running…' : 'Run'}
        </Button>
      </span>
    </Tooltip>
  );
});

RunButton.propTypes = {
  onClick:   PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
};

// ── CommandViewer ─────────────────────────────────────────────────────────────

/**
 * @param {{ batch: Object }} props
 */
export const CommandViewer = React.memo(function CommandViewer({ batch }) {
  const domain  = batch?.sheetSource;
  const logDefs = LOG_PATH_DEFS[domain] ?? [];

  // Independent run-command state for Run Command and Resume Command sections
  const runCmd    = useRunCommand();
  const resumeCmd = useRunCommand();

  // Reset both output panels whenever a different batch is selected or when
  // the modal closes (batch becomes null ~300ms after close).
  // This prevents stale output from a previous row appearing in the next open.
  useEffect(() => {
    runCmd.reset();
    resumeCmd.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.batchName]);

  const handleRun    = useCallback(() => {
    runCmd.reset();
    runCmd.execute(buildQclientLine(batch, 'runJobOnly'), 'run');
  }, [batch, runCmd]);

  const handleResume = useCallback(() => {
    resumeCmd.reset();
    resumeCmd.execute(buildQclientLine(batch, 'resumeJob'), 'resume');
  }, [batch, resumeCmd]);

  if (!batch) return null;

  return (
    <Stack spacing={0} divider={<Divider sx={{ my: 2 }} />}>

      {/* ── Change Directory ── */}
      <Section title="Change Directory">
        <CommandBlock value={batch.logDir} />
      </Section>

      {/* ── Run Command ── */}
      <Section title="Run Command">
        <CommandBlock value={buildQclientLine(batch, 'runJobOnly')} />
        {SSH_RUN_ENABLED && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RunButton
              onClick={handleRun}
              isLoading={runCmd.status === 'loading'}
            />
            {runCmd.status === 'idle' && (
              <Typography variant="caption" color="text.secondary">
                Executes the run command on the remote server via SSH.
              </Typography>
            )}
          </Box>
        )}
        <RunOutputPanel
          status={runCmd.status}
          output={runCmd.output}
          errMsg={runCmd.errMsg}
          exitCode={runCmd.exitCode}
          onDismiss={runCmd.reset}
        />
      </Section>

      {/* ── Resume Command ── */}
      <Section title="Resume Command">
        <CommandBlock value={buildQclientLine(batch, 'resumeJob')} />
        {SSH_RUN_ENABLED && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RunButton
              onClick={handleResume}
              isLoading={resumeCmd.status === 'loading'}
            />
            {resumeCmd.status === 'idle' && (
              <Typography variant="caption" color="text.secondary">
                Executes the resume command on the remote server via SSH.
              </Typography>
            )}
          </Box>
        )}
        <RunOutputPanel
          status={resumeCmd.status}
          output={resumeCmd.output}
          errMsg={resumeCmd.errMsg}
          exitCode={resumeCmd.exitCode}
          onDismiss={resumeCmd.reset}
        />
      </Section>

      {/* ── Log Paths ── */}
      <Section title="Log Paths">
        {logDefs.map(({ label, path }) => (
          <CommandBlock
            key={label}
            value={path(batch.batchName, batch.arguments)}
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
