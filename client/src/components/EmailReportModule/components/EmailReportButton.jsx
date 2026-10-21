/**
 * EmailReportButton.jsx — trigger button + VerificationModal mount point.
 *
 * Self-contained: owns the open/close state for the modal so the parent
 * (Dashboard.jsx) only needs to render <EmailReportButton onSent={srRefresh} />.
 *
 * Visual design:
 *   - Matches the adjacent "Refresh" button (same size="small" variant="outlined").
 *   - Uses the MUI Email icon consistent with the existing icon set.
 *   - Positioned in the Status Report header action area (caller controls layout).
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Button } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import { VerificationModal } from './VerificationModal';

/**
 * @param {{
 *   onSent?: () => void,   // forwarded to VerificationModal — called on successful send
 *   disabled?: boolean,
 * }} props
 */
export function EmailReportButton({ onSent, disabled = false }) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleOpen  = useCallback(() => setModalOpen(true),  []);
  const handleClose = useCallback(() => setModalOpen(false), []);

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<EmailIcon />}
        onClick={handleOpen}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-label="Open Email Status Report dialog"
      >
        Email Status Report
      </Button>

      <VerificationModal
        open={modalOpen}
        onClose={handleClose}
        onSent={onSent}
      />
    </>
  );
}

EmailReportButton.propTypes = {
  onSent:   PropTypes.func,
  disabled: PropTypes.bool,
};
