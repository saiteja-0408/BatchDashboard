/**
 * VerificationModal.jsx — full verification questionnaire dialog.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┐
 *   │ Header:  "Verification Status"  [✕ close]   │
 *   ├─────────────────────────────────────────────┤
 *   │ Top-level note textarea                     │
 *   │ ─────────────────────────────────────────── │
 *   │ Category section 1                          │
 *   │   Question 1 (radio + comment)              │
 *   │   Question 2 (radio + comment)              │
 *   │ Category section 2                          │
 *   │   …                                         │
 *   ├─────────────────────────────────────────────┤
 *   │ Footer: [Cancel]  [Send Email ▶]            │
 *   └─────────────────────────────────────────────┘
 *
 * Accessibility:
 *   - role="dialog", aria-modal="true", aria-labelledby, aria-describedby
 *   - Escape key closes the modal (MUI Dialog default).
 *   - Focus is trapped inside the dialog while open (MUI Dialog default).
 *   - Success/error alerts are announced via role="status" / role="alert".
 */

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
} from '@mui/material';
import CloseIcon    from '@mui/icons-material/Close';
import SendIcon     from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';

import { useVerificationForm }      from '../hooks/useVerificationForm';
import { VerificationQuestionItem } from './VerificationQuestionItem';
import { EmailPreviewModal }        from './EmailPreviewModal';
import { fetchEmailPreview }        from '../services/emailReportService';
import { VERIFICATION_QUESTIONS, groupQuestionsByCategory } from '../services/verificationQuestions';

// Pre-compute category groups once (pure static data — no render cost).
const CATEGORY_GROUPS = groupQuestionsByCategory();

/**
 * @param {{
 *   open:       boolean,
 *   onClose:    () => void,
 *   onSent?:    () => void,   // called after successful send (e.g. trigger refresh)
 * }} props
 */
export function VerificationModal({ open, onClose, onSent }) {
  const titleId       = 'verification-modal-title';
  const descriptionId = 'verification-modal-description';

  // Close the modal after a brief success flash, then call onSent.
  const successTimerRef = useRef(null);

  const handleSuccess = () => {
    // Give the user 1.5 s to read the success state before closing.
    successTimerRef.current = setTimeout(() => {
      if (typeof onSent === 'function') onSent();
      onClose();
    }, 1500);
  };

  const {
    formState,
    answersMap,
    errors,
    isSubmitting,
    isSubmitSuccess,
    submitError,
    emailConfig,
    isLoadingAutoChecks,
    loadAutoChecks,
    setHeaderComment,
    setAnswer,
    setComment,
    validate,
    buildPayload,
    submit,
    reset,
  } = useVerificationForm({ onSuccess: handleSuccess });

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Load automated DB checks whenever modal opens
  useEffect(() => {
    if (open) {
      loadAutoChecks();
    } else {
      clearTimeout(successTimerRef.current);
      setPreviewOpen(false);
      setPreviewHtml('');
      reset();
    }
    return () => clearTimeout(successTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpenPreview = async () => {
    setIsPreviewLoading(true);
    try {
      const payload = buildPayload();
      const res = await fetchEmailPreview(payload);
      setPreviewHtml(res?.html || '');
      setPreviewOpen(true);
    } catch (err) {
      console.warn('Failed to fetch preview:', err.message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
  };

  const handleSendFromPreview = async () => {
    setPreviewOpen(false);
    await submit();
  };

  const handleClose = () => {
    if (isSubmitting) return;  // prevent close while in-flight
    clearTimeout(successTimerRef.current);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      fullWidth
      maxWidth="md"
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight:    '92vh',
        },
      }}
    >
      {/* ── Dialog Header ── */}
      <DialogTitle
        id={titleId}
        sx={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          borderBottom:   '1px solid',
          borderColor:    'divider',
          pb: 1.5,
        }}
      >
        <Typography variant="h6" fontWeight={700} component="span">
          Verification Status
        </Typography>
        <IconButton
          aria-label="Close verification dialog"
          onClick={handleClose}
          disabled={isSubmitting}
          size="small"
          edge="end"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* ── Dialog Body ── */}
      <DialogContent
        id={descriptionId}
        dividers={false}
        sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1 }}
      >
        {/* Success state overlay */}
        {isSubmitSuccess && (
          <Box
            role="status"
            aria-live="polite"
            sx={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              py: 6,
              gap: 1.5,
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main' }} />
            <Typography variant="h6" fontWeight={600} color="success.main">
              Email dispatched successfully!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The verification status report has been sent.
            </Typography>
          </Box>
        )}

        {/* Normal form */}
        {!isSubmitSuccess && (
          <>
            {/* Submission error banner */}
            {submitError && (
              <Alert
                severity="error"
                role="alert"
                sx={{ mb: 2, fontSize: '0.83rem' }}
              >
                {submitError}
              </Alert>
            )}

            {/* Top-level comment / note */}
            <Box mb={2.5}>
              <Typography
                variant="subtitle2"
                fontWeight={600}
                gutterBottom
                id="header-comment-label"
              >
                Overall Verification Notes
              </Typography>
              <TextField
                aria-labelledby="header-comment-label"
                fullWidth
                multiline
                minRows={2}
                maxRows={4}
                size="small"
                placeholder="Enter any top-level notes or remarks about today's verification status…"
                value={formState.headerComment}
                onChange={(e) => setHeaderComment(e.target.value)}
                disabled={isSubmitting}
                inputProps={{ maxLength: 3000 }}
              />
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Questionnaire — grouped by category */}
            {Array.from(CATEGORY_GROUPS.entries()).map(([category, questions]) => (
              <Box key={category} mb={3}>
                {/* Category heading */}
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{
                    mb:           1,
                    pb:           0.5,
                    borderBottom: '2px solid',
                    borderColor:  'primary.main',
                    color:        'primary.main',
                    fontSize:     '0.9rem',
                    letterSpacing: 0.3,
                  }}
                >
                  {category}
                </Typography>

                {/* Question items for this category */}
                <Box
                  component="section"
                  aria-label={`${category} questions`}
                  sx={{
                    border:       '1px solid',
                    borderColor:  'divider',
                    borderRadius: 1,
                    overflow:     'hidden',
                  }}
                >
                  {questions.map((question) => {
                    const answer = answersMap.get(question.id) ?? {
                      questionId: question.id,
                      value:      '',
                      comment:    '',
                    };
                    return (
                      <VerificationQuestionItem
                        key={question.id}
                        question={question}
                        answer={answer}
                        radioError={errors[question.id]}
                        commentError={errors[`${question.id}__comment`]}
                        onAnswerChange={setAnswer}
                        onCommentChange={setComment}
                        disabled={isSubmitting}
                      />
                    );
                  })}
                </Box>
              </Box>
            ))}
          </>
        )}
      </DialogContent>

      {/* ── Dialog Footer ── */}
      {!isSubmitSuccess && (
        <DialogActions
          sx={{
            px:           { xs: 2, sm: 3 },
            py:           2,
            borderTop:    '1px solid',
            borderColor:  'divider',
            gap:          1,
            justifyContent: 'flex-end',
          }}
        >
          <Button
            variant="outlined"
            color="inherit"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button
            variant="outlined"
            color="primary"
            onClick={handleOpenPreview}
            disabled={isSubmitting || isPreviewLoading}
            startIcon={
              isPreviewLoading
                ? <CircularProgress size={16} color="inherit" />
                : <VisibilityIcon fontSize="small" />
            }
          >
            Preview Email
          </Button>

          <Button
            variant="contained"
            color="primary"
            onClick={submit}
            disabled={isSubmitting}
            startIcon={
              isSubmitting
                ? <CircularProgress size={16} color="inherit" />
                : <SendIcon fontSize="small" />
            }
          >
            {isSubmitting ? 'Sending…' : 'Send Email'}
          </Button>
        </DialogActions>
      )}

      {/* ── Preview Sub-Modal ── */}
      <EmailPreviewModal
        open={previewOpen}
        onClose={handleClosePreview}
        onSend={handleSendFromPreview}
        previewHtml={previewHtml}
        emailConfig={emailConfig}
        isSending={isSubmitting}
      />
    </Dialog>
  );
}

VerificationModal.propTypes = {
  open:    PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSent:  PropTypes.func,
};
