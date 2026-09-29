/**
 * CommandViewer.jsx — displays server commands for a batch in a code-block style UI
 * with copy-to-clipboard buttons and syntax highlighting via monospace font.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Box, Typography, Tooltip, IconButton, Stack, Chip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { COMMAND_CATEGORIES } from '../../utils/constants';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

/**
 * Single command row with label, monospace code block, and copy button.
 */
function CommandRow({ label, value }) {
  const { copy, copied } = useCopyToClipboard();

  if (!value) return null;

  return (
    <Box
      sx={{
        mb: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: 1.5, py: 0.5,
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Chip label={label} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
        <Tooltip title={copied ? 'Copied!' : 'Copy'}>
          <IconButton size="small" onClick={() => copy(value)}>
            {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          px: 1.5, py: 1,
          fontSize: '0.82rem',
          fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          bgcolor: 'background.default',
          color: 'text.primary',
          overflowX: 'auto',
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

CommandRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
};

/**
 * Renders all command categories for a given batch.
 * @param {{ batch: Object }} props
 */
export function CommandViewer({ batch }) {
  if (!batch) return null;

  const hasAnyCommand = COMMAND_CATEGORIES.some(({ field }) => batch[field]);
  if (!hasAnyCommand) {
    return (
      <Typography variant="body2" color="text.secondary">
        No commands defined for this batch.
      </Typography>
    );
  }

  return (
    <Stack spacing={0}>
      {COMMAND_CATEGORIES.map(({ label, field }) =>
        batch[field] ? <CommandRow key={field} label={label} value={batch[field]} /> : null
      )}
    </Stack>
  );
}

CommandViewer.propTypes = {
  batch: PropTypes.shape({
    startCommand:  PropTypes.string,
    stopCommand:   PropTypes.string,
    statusCommand: PropTypes.string,
    logPath:       PropTypes.string,
    configPath:    PropTypes.string,
  }),
};
