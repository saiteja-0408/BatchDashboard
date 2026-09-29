/**
 * BatchDetailModal.jsx — full detail modal for a selected batch.
 * Shows all metadata and the command viewer in a tabbed layout.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Tabs, Tab, Box, Typography, Chip, Divider,
  Grid, IconButton, Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { CommandViewer } from '../CommandViewer/CommandViewer';
import { formatDate } from '../../utils/helpers';
import { STATUS_COLORS, COLUMN_LABELS } from '../../utils/constants';
import { useBatchContext } from '../../context/BatchContext';

function TabPanel({ children, value, index }) {
  return (
    <Box role="tabpanel" hidden={value !== index} pt={2}>
      {value === index && children}
    </Box>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  value:    PropTypes.number.isRequired,
  index:    PropTypes.number.isRequired,
};

function InfoRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <>
      <Grid item xs={5} sm={4}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {label}
        </Typography>
      </Grid>
      <Grid item xs={7} sm={8}>
        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
          {value}
        </Typography>
      </Grid>
    </>
  );
}

InfoRow.propTypes = { label: PropTypes.string, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) };

export function BatchDetailModal() {
  const { selectedBatch: batch, isModalOpen, closeBatchModal } = useBatchContext();
  const [tab, setTab] = useState(0);
  const navigate = useNavigate();

  if (!batch) return null;

  const handleOpenDetail = () => {
    closeBatchModal();
    navigate(`/batch/${batch.batchId}`);
  };

  return (
    <Dialog
      open={isModalOpen}
      onClose={closeBatchModal}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="h6" component="span">{batch.batchName}</Typography>
          <Chip
            label={batch.lastRunStatus || 'Unknown'}
            color={STATUS_COLORS[batch.lastRunStatus] || 'default'}
            size="small"
            sx={{ ml: 1 }}
          />
        </Box>
        <Box>
          <Tooltip title="Open full detail page">
            <IconButton size="small" onClick={handleOpenDetail} sx={{ mr: 1 }}>
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={closeBatchModal}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      <Box sx={{ px: 3, pt: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Details" />
          <Tab label="Commands" />
        </Tabs>
      </Box>

      <DialogContent>
        <TabPanel value={tab} index={0}>
          <Grid container spacing={1}>
            <InfoRow label={COLUMN_LABELS.batchId}       value={batch.batchId} />
            <InfoRow label={COLUMN_LABELS.domain}        value={batch.domain} />
            <InfoRow label={COLUMN_LABELS.frequency}     value={batch.frequency} />
            <InfoRow label={COLUMN_LABELS.scheduleTime}  value={batch.scheduleTime} />
            <InfoRow label={COLUMN_LABELS.environment}   value={batch.environment} />
            <InfoRow label={COLUMN_LABELS.ownerTeam}     value={batch.ownerTeam} />
            <InfoRow label={COLUMN_LABELS.lastRunTime}   value={formatDate(batch.lastRunTime)} />
            <InfoRow label={COLUMN_LABELS.nextRunTime}   value={formatDate(batch.nextRunTime)} />
            <InfoRow label={COLUMN_LABELS.lastRunStatus} value={batch.lastRunStatus} />
            <InfoRow label={COLUMN_LABELS.description}   value={batch.description} />
            <InfoRow label={COLUMN_LABELS.notes}         value={batch.notes} />
          </Grid>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <CommandViewer batch={batch} />
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={closeBatchModal} size="small">Close</Button>
        <Button onClick={handleOpenDetail} variant="contained" size="small">
          Full Detail Page
        </Button>
      </DialogActions>
    </Dialog>
  );
}
