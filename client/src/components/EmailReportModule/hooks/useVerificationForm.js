/**
 * useVerificationForm.js — state manager for the Verification & Email modal form.
 *
 * Responsibilities (single-responsibility per concern):
 *   1. Initialise form state from VERIFICATION_QUESTIONS on mount.
 *   2. Expose per-question and top-level field setters.
 *   3. Run validation and accumulate field-level errors.
 *   4. Build the structured EmailReportPayload and invoke dispatchEmailReport.
 *   5. Expose submission status (isSubmitting, isSubmitSuccess, submitError).
 *   6. Provide a reset() function to restore the form to its initial state.
 *
 * This hook has no UI dependencies — it is a pure logic layer that can be
 * tested without rendering any component.
 *
 * @module useVerificationForm
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { VERIFICATION_QUESTIONS } from '../services/verificationQuestions';
import { dispatchEmailReport, fetchAutoChecks, generateReportId } from '../services/emailReportService';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the initial answers array from the question definitions.
 * Each question gets an initial value and comment.
 *
 * @param {Object} [autoChecksMap={}]
 * @returns {import('../types/emailReport.types').QuestionAnswer[]}
 */
function buildInitialAnswers(autoChecksMap = {}) {
  return VERIFICATION_QUESTIONS.map((q) => {
    const auto = autoChecksMap[q.id];
    let initialValue = auto?.value ?? (q.id === 'app-mobile-app-check' ? 'na' : (q.id === 'batch-hung' ? 'no' : 'yes'));
    let initialComment = auto?.comment ?? (q.id === 'app-mobile-app-check' ? 'NOTE - This validation is no longer applicable and can be disregarded.' : '');

    return {
      questionId: q.id,
      value:      initialValue,
      comment:    initialComment,
    };
  });
}

/** @returns {import('../types/emailReport.types').VerificationFormState} */
function buildInitialState() {
  return {
    headerComment: '',
    answers:       buildInitialAnswers(),
    isDirty:       false,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @param {{ onSuccess?: () => void }} [options]
 *   - onSuccess: optional callback fired after a successful submission
 *     (e.g. close the modal and trigger a report refresh).
 *
 * @returns {import('../types/emailReport.types').UseVerificationFormReturn}
 */
export function useVerificationForm(options = {}) {
  const { onSuccess } = options;

  // ── Core state ─────────────────────────────────────────────────────────────
  const [formState,          setFormState]          = useState(buildInitialState);
  const [errors,             setErrors]             = useState(/** @type {import('../types/emailReport.types').ValidationErrors} */({}));
  const [isSubmitting,       setIsSubmitting]       = useState(false);
  const [isSubmitSuccess,    setIsSubmitSuccess]    = useState(false);
  const [submitError,        setSubmitError]        = useState(/** @type {string|null} */(null));
  const [emailConfig,        setEmailConfig]        = useState(null);
  const [isLoadingAutoChecks, setIsLoadingAutoChecks] = useState(false);

  /** Loads automated DB checks and email settings from server */
  const loadAutoChecks = useCallback(async () => {
    setIsLoadingAutoChecks(true);
    try {
      const data = await fetchAutoChecks();
      if (data?.autoChecks) {
        setFormState((prev) => ({
          ...prev,
          answers: buildInitialAnswers(data.autoChecks),
        }));
      }
      if (data?.emailConfig) {
        setEmailConfig(data.emailConfig);
      }
    } catch (err) {
      console.warn('Failed to load auto-checks from server:', err.message);
      // Fall back to local defaults
      setFormState((prev) => ({
        ...prev,
        answers: buildInitialAnswers({}),
      }));
    } finally {
      setIsLoadingAutoChecks(false);
    }
  }, []);

  // ── Setters ────────────────────────────────────────────────────────────────

  /** Updates the top-level header comment. */
  const setHeaderComment = useCallback((value) => {
    setFormState((prev) => ({
      ...prev,
      headerComment: value,
      isDirty:       true,
    }));
    // Clear the header error as soon as the user starts typing.
    setErrors((prev) => {
      if (!prev.headerComment) return prev;
      const { headerComment: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  /**
   * Updates the radio selection for a question.
   * @param {string} questionId
   * @param {'yes'|'no'} value
   */
  const setAnswer = useCallback((questionId, value) => {
    setFormState((prev) => ({
      ...prev,
      isDirty: true,
      answers: prev.answers.map((a) =>
        a.questionId === questionId ? { ...a, value } : a
      ),
    }));
    // Clear the per-question error on change.
    setErrors((prev) => {
      if (!prev[questionId]) return prev;
      const { [questionId]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  /**
   * Updates the comment text for a question.
   * @param {string} questionId
   * @param {string} comment
   */
  const setComment = useCallback((questionId, comment) => {
    setFormState((prev) => ({
      ...prev,
      isDirty: true,
      answers: prev.answers.map((a) =>
        a.questionId === questionId ? { ...a, comment } : a
      ),
    }));
    // Clear the per-question comment error on change.
    setErrors((prev) => {
      const commentKey = `${questionId}__comment`;
      if (!prev[commentKey]) return prev;
      const { [commentKey]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────

  /**
   * Runs full-form validation.  Populates errors state and returns whether the
   * form is valid (true = no errors).
   *
   * Rules:
   *   - Every question with required:true must have a non-empty radio value.
   *   - Every question with commentRequired:true must have a non-empty comment.
   *
   * @returns {boolean}  true when form is valid
   */
  const validate = useCallback(() => {
    /** @type {import('../types/emailReport.types').ValidationErrors} */
    const newErrors = {};

    for (const question of VERIFICATION_QUESTIONS) {
      const answer = formState.answers.find((a) => a.questionId === question.id);
      if (!answer) continue;

      // Required radio selection
      if (question.required && !answer.value) {
        newErrors[question.id] = 'Please select Yes or No.';
      }

      // Required comment
      if (question.commentRequired && !answer.comment.trim()) {
        newErrors[`${question.id}__comment`] = 'A comment is required for this question.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formState.answers]);

  // ── Payload builder ────────────────────────────────────────────────────────

  /**
   * Builds the EmailReportPayload from the current form state.
   * Memoised so it does not recompute on every render.
   *
   * @returns {import('../types/emailReport.types').EmailReportPayload}
   */
  const buildPayload = useCallback(() => {
    /** @type {import('../types/emailReport.types').AnswerPayloadItem[]} */
    const answers = formState.answers.map((a) => {
      const question = VERIFICATION_QUESTIONS.find((q) => q.id === a.questionId);
      return {
        questionId:    a.questionId,
        questionLabel: question?.label ?? a.questionId,
        value:         a.value,
        comment:       a.comment.trim(),
        category:      question?.category,
      };
    });

    return {
      reportId:      generateReportId(),
      timestamp:     new Date().toISOString(),
      submittedBy:   'Dashboard User',  // placeholder — replace with auth context if available
      headerComment: formState.headerComment.trim(),
      answers,
    };
  }, [formState]);

  // ── Submission ─────────────────────────────────────────────────────────────

  /**
   * Validates the form, builds the payload, and dispatches the email.
   * Sets isSubmitting while in-flight; updates isSubmitSuccess / submitError on completion.
   *
   * @returns {Promise<void>}
   */
  const submit = useCallback(async () => {
    setSubmitError(null);
    setIsSubmitSuccess(false);

    const isValid = validate();
    if (!isValid) return;

    const payload = buildPayload();

    setIsSubmitting(true);
    try {
      await dispatchEmailReport(payload);
      setIsSubmitSuccess(true);
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (err) {
      setSubmitError(err.message ?? 'Email dispatch failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [validate, buildPayload, onSuccess]);

  // ── Reset ──────────────────────────────────────────────────────────────────

  /** Resets the entire form to its initial blank state. */
  const reset = useCallback(() => {
    setFormState(buildInitialState());
    setErrors({});
    setIsSubmitting(false);
    setIsSubmitSuccess(false);
    setSubmitError(null);
  }, []);

  // ── Answer lookup for components ──────────────────────────────────────────

  /**
   * Derived map: questionId → QuestionAnswer.
   * Allows O(1) look-ups in VerificationQuestionItem without scanning the array.
   *
   * @type {Map<string, import('../types/emailReport.types').QuestionAnswer>}
   */
  const answersMap = useMemo(
    () => new Map(formState.answers.map((a) => [a.questionId, a])),
    [formState.answers]
  );

  return {
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
  };
}
