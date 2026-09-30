/**
 * BatchDetailModal.jsx — full detail modal for a selected batch.
 *
 * Tab layout:
 *   Tab 0 — "Benefits and Tax"  : batch metadata + Run/Resume commands (existing)
 *   Tab 1 — "Status Report"     : live DB2 status report table (new)
 *
 * The Status Report tab fetches lazily — the DB2 call is only triggered the
 * first time the tab is opened, and the result is cached server-side for 5 min.
 *
 * Displays a schedule name warning badge when the schedule is not in the approved list.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Tabs, Tab, Box, Typography, Chip, Divider,
  Grid, IconButton, Tooltip, Alert,
} from '@mui/material';
import CloseIcon        from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { CommandViewer }    from '../CommandViewer/CommandViewer';
import { StatusReportTab }  from '../StatusReportTab/StatusReportTab';
import { COLUMN_LABELS, SHEET_LABELS } from '../../utils/constants';
import { useBatchContext }  from '../../context/BatchContext';

/** Generic accessible tab panel wrapper */
function TabPanel({ children, value, index }) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`detail-tabpanel-${index}`}
      aria-labelledby={`detail-tab-${index}`}
      pt={2}
    >
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
InfoRow.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export function BatchDetailModal() {
  const { selectedBatch: batch, isModalOpen, closeBatchModal } = useBatchContext();
  const [tab, setTab] = useState(0);

  // Track whether the Status Report tab has ever been opened this session.
  // Once true it stays true — the hook stays enabled so data doesn't disappear
  // when the user switches away and back.
  const [statusReportActivated, setStatusReportActivated] = useState(false);

  const handleTabChange = (_, newTab) => {
    setTab(newTab);
    if (newTab === 1) setStatusReportActivated(true);
  };

  const handleClose = () => {
    setTab(0);
    setStatusReportActivated(false);
    closeBatchModal();
  };

  if (!batch) return null;

  const sheetLabel = SHEET_LABELS[batch.sheetSource] || batch.sheetSource || '—';

  return (
    <Dialog
      open={isModalOpen}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      scroll="paper"
    >
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pb: 1 }}
      >
        <Box sx={{ flex: 1, mr: 1 }}>
          <Typography variant="h6" component="span" sx={{ wordBreak: 'break-word' }}>
            {batch.batchName}
          </Typography>
          {/* Schedule warning badge in title area */}
          {!batch.scheduleValid && batch.scheduleName && (
            <Tooltip title={`Schedule "${batch.scheduleName}" is not in the approved list`}>
              <Chip
                icon={<WarningAmberIcon fontSize="small" />}
                label="Unknown Schedule"
                color="warning"
                size="small"
                sx={{ ml: 1, verticalAlign: 'middle' }}
              />
            </Tooltip>
          )}
          <Box mt={0.5}>
            <Chip label={sheetLabel} size="small" variant="outlined" sx={{ mr: 0.5 }} />
          </Box>
        </Box>
        <IconButton size="small" onClick={handleClose} sx={{ mt: 0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Divider />

      {/* ── Tab strip ── */}
      <Box sx={{ px: 3, pt: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tab}
          onChange={handleTabChange}
          aria-label="Batch detail tabs"
        >
          <Tab
            label="Benefits and Tax"
            id="detail-tab-0"
            aria-controls="detail-tabpanel-0"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          />
          <Tab
            label="Status Report"
            id="detail-tab-1"
            aria-controls="detail-tabpanel-1"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          />
        </Tabs>
      </Box>

      <DialogContent>
        {/* ══ Tab 0 — Benefits and Tax (existing content, untouched) ══ */}
        <TabPanel value={tab} index={0}>
          {/* Schedule validity warning */}
          {!batch.scheduleValid && batch.scheduleName && (
            <Alert severity="warning" sx={{ mb: 2, fontSize: '0.82rem' }}>
              Schedule name <strong>"{batch.scheduleName}"</strong> is not in the
              approved list. This row was loaded from Excel as-is.
            </Alert>
          )}

          {/* Batch metadata */}
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>
            Details
          </Typography>
          <Grid container spacing={1} sx={{ mb: 3 }}>
            <InfoRow label={COLUMN_LABELS.batchName}    value={batch.batchName} />
            <InfoRow label={COLUMN_LABELS.scheduleName} value={batch.scheduleName} />
            <InfoRow label={COLUMN_LABELS.arguments}    value={batch.arguments || '(none)'} />
            <InfoRow label={COLUMN_LABELS.sheetSource}  value={sheetLabel} />
            <InfoRow label={COLUMN_LABELS.logDir}       value={batch.logDir} />
          </Grid>

          <Divider sx={{ mb: 2 }} />

          {/* Run / Resume commands */}
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>
            Run / Resume Commands
          </Typography>
          <CommandViewer batch={batch} />
        </TabPanel>

        {/* ══ Tab 1 — Status Report (new) ══ */}
        <TabPanel value={tab} index={1}>
          <StatusReportTab enabled={statusReportActivated} />
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} size="small">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
