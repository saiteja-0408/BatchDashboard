/**
 * VerificationCommentField.jsx — reusable comment textarea for a verification question.
 *
 * Rendered inside VerificationQuestionItem when the question type includes a
 * comment field ('yes-no-comment' or 'text-only').
 *
 * Accessibility:
 *   - Rendered as a labelled MUI TextField (textarea mode).
 *   - Associates the textarea with its label via a stable `id` derived from questionId.
 *   - Error text is announced by screen readers via aria-describedby on the input.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { TextField } from '@mui/material';

/**
 * @param {{
 *   questionId:   string,
 *   value:        string,
 *   onChange:     (value: string) => void,
 *   error?:       string,
 *   required?:    boolean,
 *   placeholder?: string,
 *   label?:       string,
 *   disabled?:    boolean,
 * }} props
 */
export function VerificationCommentField({
  questionId,
  value,
  onChange,
  error,
  required  = false,
  placeholder = 'Add a comment or remark (optional)…',
  label     = 'Comment',
  disabled  = false,
}) {
  const inputId   = `comment-field-${questionId}`;
  const errorId   = `${inputId}-error`;

  return (
    <TextField
      id={inputId}
      inputProps={{
        'aria-describedby': error ? errorId : undefined,
      }}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      multiline
      minRows={2}
      maxRows={5}
      fullWidth
      size="small"
      required={required}
      disabled={disabled}
      error={Boolean(error)}
      helperText={error
        ? <span id={errorId}>{error}</span>
        : undefined
      }
      placeholder={placeholder}
      sx={{ mt: 1 }}
      inputProps={{
        maxLength:         2000,
        'aria-describedby': error ? errorId : undefined,
      }}
    />
  );
}

VerificationCommentField.propTypes = {
  questionId:  PropTypes.string.isRequired,
  value:       PropTypes.string.isRequired,
  onChange:    PropTypes.func.isRequired,
  error:       PropTypes.string,
  required:    PropTypes.bool,
  placeholder: PropTypes.string,
  label:       PropTypes.string,
  disabled:    PropTypes.bool,
};
