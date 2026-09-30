/**
 * CommandViewer.jsx — displays the run and resume qclient commands for a batch.
 *
 * Commands are constructed from batch fields using buildCommand():
 *   <logDir>
 *   sudo ./qclient.sh <action> <batchName> <scheduleName> ["<arguments>"]
 *
 * The arguments portion is omitted when the arguments field is empty.
 * The schedule name is sourced directly from the batch row — never guessed.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Box, Typography, Tooltip, IconButton, Stack, Chip, Alert,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon       from '@mui/icons-material/Check';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { buildCommand, VALID_SCHEDULE_NAMES } from '../../utils/constants';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

const COMMAND_DEFS = [
  { label: 'Run',    action: 'runJobOnly' },
  { label: 'Resume', action: 'resumeJob'  },
];

/**
 * Single command block: label chip, monospace code, copy button.
 */
function CommandBlock({ label, value }) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <Box
      sx={{
        mb: 2,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          px: 1.5, py: 0.5,
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Chip label={label} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
        <Tooltip title={copied ? 'Copied!' : 'Copy command'}>
          <IconButton size="small" onClick={() => copy(value)}>
            {copied
              ? <CheckIcon fontSize="small" color="success" />
              : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Command body */}
      <Box
        component="pre"
        sx={{
          m: 0,
          px: 1.5, py: 1.5,
          fontSize: 'clamp(0.72rem, 1.5vw, 0.82rem)',
          fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          bgcolor: 'background.default',
          color: 'text.primary',
          lineHeight: 1.8,
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

CommandBlock.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};

/**
 * Renders the run and resume commands for a given batch.
 * Shows a warning banner if the schedule name is not in the approved list.
 *
 * @param {{ batch: Object }} props
 */
export const CommandViewer = React.memo(function CommandViewer({ batch }) {
  if (!batch) return null;

  const scheduleIsValid = VALID_SCHEDULE_NAMES.has(batch.scheduleName);

  return (
    <Stack spacing={0}>
      {/* Schedule name warning banner */}
      {!scheduleIsValid && batch.scheduleName && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon fontSize="inherit" />}
          sx={{ mb: 2, fontSize: '0.82rem' }}
        >
          Schedule name <strong>"{batch.scheduleName}"</strong> is not in the approved
          list. The command below is shown as-is from the Excel data — verify before
          running.
        </Alert>
      )}

      {!batch.scheduleName && (
        <Alert severity="error" sx={{ mb: 2, fontSize: '0.82rem' }}>
          No schedule name found for this batch. Command cannot be constructed.
        </Alert>
      )}

      {/* Run and Resume command blocks */}
      {COMMAND_DEFS.map(({ label, action }) => (
        <CommandBlock
          key={action}
          label={label}
          value={buildCommand(batch, action)}
        />
      ))}

      {/* Arguments info row */}
      {batch.arguments && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Arguments: <code>{batch.arguments}</code>
        </Typography>
      )}
    </Stack>
  );
});

CommandViewer.propTypes = {
  batch: PropTypes.shape({
    batchName:     PropTypes.string,
    scheduleName:  PropTypes.string,
    arguments:     PropTypes.string,
    logDir:        PropTypes.string,
    scheduleValid: PropTypes.bool,
  }),
};
