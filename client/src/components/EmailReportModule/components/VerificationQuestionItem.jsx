/**
 * VerificationQuestionItem.jsx — renders a single verification question row.
 *
 * Supports three question types (controlled by question.type):
 *   - 'yes-no'         → Yes/No radio group only
 *   - 'yes-no-comment' → Yes/No radio group + optional VerificationCommentField
 *   - 'text-only'      → VerificationCommentField only
 *
 * Accessibility:
 *   - RadioGroup has a stable aria-labelledby pointing to the question label.
 *   - Each RadioGroup uses role="radiogroup" (native via MUI RadioGroup).
 *   - Keyboard navigation follows ARIA radio group pattern:
 *       Tab  → enters / exits the radio group
 *       ←/→  → moves between Yes and No within the group
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Box, FormControl, FormLabel, FormHelperText,
  RadioGroup, FormControlLabel, Radio, Typography,
} from '@mui/material';
import { VerificationCommentField } from './VerificationCommentField';

/**
 * @param {{
 *   question:       import('../types/emailReport.types').VerificationQuestion,
 *   answer:         import('../types/emailReport.types').QuestionAnswer,
 *   radioError?:    string,
 *   commentError?:  string,
 *   onAnswerChange: (questionId: string, value: 'yes'|'no') => void,
 *   onCommentChange:(questionId: string, comment: string)   => void,
 *   disabled?:      boolean,
 * }} props
 */
export function VerificationQuestionItem({
  question,
  answer,
  radioError,
  commentError,
  onAnswerChange,
  onCommentChange,
  disabled = false,
}) {
  const labelId  = `question-label-${question.id}`;
  const groupId  = `radio-group-${question.id}`;
  const errorId  = `radio-error-${question.id}`;

  const showRadio   = question.type === 'yes-no' || question.type === 'yes-no-comment';
  const showComment = question.type === 'yes-no-comment' || question.type === 'text-only';

  return (
    <Box
      sx={{
        py: 1.5,
        px: { xs: 1, sm: 2 },
        borderBottom: '1px solid',
        borderColor:  'divider',
        '&:last-child': { borderBottom: 0 },
      }}
    >
      {/* Question label + optional help text */}
      <Typography
        id={labelId}
        variant="body2"
        fontWeight={500}
        sx={{ mb: 0.5, lineHeight: 1.5 }}
      >
        {question.label}
        {question.required && (
          <Typography component="span" color="error" sx={{ ml: 0.25 }} aria-hidden="true">
            *
          </Typography>
        )}
      </Typography>

      {question.helpText && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
          {question.helpText}
        </Typography>
      )}

      {/* Yes / No radio group */}
      {showRadio && (
        <FormControl
          component="fieldset"
          error={Boolean(radioError)}
          disabled={disabled}
          sx={{ display: 'block' }}
        >
          <RadioGroup
            id={groupId}
            aria-labelledby={labelId}
            aria-describedby={radioError ? errorId : undefined}
            row
            value={answer.value}
            onChange={(e) => onAnswerChange(question.id, e.target.value)}
            name={groupId}
          >
            <FormControlLabel
              value="yes"
              control={<Radio size="small" />}
              label="Yes"
              sx={{ mr: 3 }}
            />
            <FormControlLabel
              value="no"
              control={<Radio size="small" />}
              label="No"
            />
          </RadioGroup>
          {radioError && (
            <FormHelperText id={errorId} error>
              {radioError}
            </FormHelperText>
          )}
        </FormControl>
      )}

      {/* Comment field — always shown for 'text-only'; shown conditionally otherwise */}
      {showComment && (
        <VerificationCommentField
          questionId={question.id}
          value={answer.comment}
          onChange={(val) => onCommentChange(question.id, val)}
          error={commentError}
          required={question.commentRequired}
          disabled={disabled}
          placeholder={
            question.type === 'yes-no-comment'
              ? 'Add a comment or remark (optional)…'
              : 'Required — please describe the issue…'
          }
        />
      )}
    </Box>
  );
}

VerificationQuestionItem.propTypes = {
  question:        PropTypes.shape({
    id:              PropTypes.string.isRequired,
    label:           PropTypes.string.isRequired,
    type:            PropTypes.oneOf(['yes-no', 'yes-no-comment', 'text-only']).isRequired,
    required:        PropTypes.bool.isRequired,
    commentRequired: PropTypes.bool.isRequired,
    category:        PropTypes.string,
    helpText:        PropTypes.string,
  }).isRequired,
  answer:          PropTypes.shape({
    questionId: PropTypes.string.isRequired,
    value:      PropTypes.string.isRequired,
    comment:    PropTypes.string.isRequired,
  }).isRequired,
  radioError:      PropTypes.string,
  commentError:    PropTypes.string,
  onAnswerChange:  PropTypes.func.isRequired,
  onCommentChange: PropTypes.func.isRequired,
  disabled:        PropTypes.bool,
};
