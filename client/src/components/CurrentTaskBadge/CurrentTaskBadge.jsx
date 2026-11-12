/**
 * CurrentTaskBadge.jsx — displays the current-task status for a single batch row.
 *
 * Props:
 *   currentTask — the { status, frequency, description, nextRun } object from
 *                 the /api/current-tasks response, or undefined/null when loading.
 *
 * Status colours:
 *   active   → green  (job is likely running right now)
 *   upcoming → amber  (job fires within the next 60 minutes)
 *   idle     → grey   (no run imminent)
 *   unknown  → grey   (schedule could not be parsed)
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Box, Chip, Typography, Tooltip, Skeleton } from '@mui/material';
import AccessTimeIcon   from '@mui/icons-material/AccessTime';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import ScheduleIcon     from '@mui/icons-material/Schedule';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';

const STATUS_CONFIG = {
  active: {
    label:  'Active',
    color:  'success',
    icon:   <CheckCircleIcon fontSize="inherit" />,
  },
  upcoming: {
    label:  'Upcoming',
    color:  'warning',
    icon:   <AccessTimeIcon fontSize="inherit" />,
  },
  idle: {
    label:  'Idle',
    color:  'default',
    icon:   <RemoveCircleOutlineIcon fontSize="inherit" />,
  },
  unknown: {
    label:  'Unknown',
    color:  'default',
    icon:   <ScheduleIcon fontSize="inherit" />,
  },
};

/**
 * Formats an ISO date string as local short time (e.g. "09:30 AM").
 * @param {string|null} iso
 * @returns {string}
 */
function fmtNextRun(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * @param {{ currentTask: Object|null|undefined, isLoading: boolean }} props
 */
export function CurrentTaskBadge({ currentTask, isLoading }) {
  if (isLoading) {
    return <Skeleton variant="rounded" width={80} height={22} />;
  }

  if (!currentTask) {
    return (
      <Typography variant="caption" color="text.disabled">—</Typography>
    );
  }

  const status = currentTask.status || 'unknown';
  const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;

  const tooltipContent = (
    <Box>
      <Typography variant="caption" display="block" fontWeight={700}>
        {currentTask.description || 'Schedule unknown'}
      </Typography>
      <Typography variant="caption" display="block">
        Next run: {fmtNextRun(currentTask.nextRun)}
      </Typography>
      <Typography variant="caption" display="block" color="text.secondary">
        Frequency: {currentTask.frequency}
      </Typography>
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} arrow placement="top">
      <Box sx={{ display: 'inline-flex', flexDirection: 'column', gap: 0.25 }}>
        <Chip
          icon={cfg.icon}
          label={cfg.label}
          color={cfg.color}
          size="small"
          variant={status === 'active' ? 'filled' : 'outlined'}
          sx={{ fontWeight: 600, cursor: 'default' }}
        />
        {currentTask.nextRun && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: 'clamp(0.6rem, 1.1vw, 0.68rem)', textAlign: 'center', lineHeight: 1.2 }}
          >
            {fmtNextRun(currentTask.nextRun)}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

CurrentTaskBadge.propTypes = {
  currentTask: PropTypes.shape({
    status:      PropTypes.string,
    frequency:   PropTypes.string,
    description: PropTypes.string,
    nextRun:     PropTypes.string,
  }),
  isLoading: PropTypes.bool,
};
