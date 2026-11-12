/**
 * emailReport.types.js — JSDoc type definitions for the Email Status Report module.
 *
 * All cross-module types are centralised here to enforce a single source of
 * truth for shape contracts between components, hooks, and the API service.
 *
 * @module emailReport.types
 */

// ── Questionnaire schema ──────────────────────────────────────────────────────

/**
 * @typedef {'yes-no' | 'yes-no-comment' | 'text-only'} QuestionType
 * Controls the input controls rendered for a single question item:
 *   - 'yes-no'         → Yes/No radio group, no comment field
 *   - 'yes-no-comment' → Yes/No radio group + optional comment textarea
 *   - 'text-only'      → Comment textarea only (no radio buttons)
 */

/**
 * A single verification question definition (static, config-driven).
 *
 * @typedef {Object} VerificationQuestion
 * @property {string}       id              - Unique stable identifier (kebab-case)
 * @property {string}       label           - Human-readable question prompt
 * @property {QuestionType} type            - Controls which inputs are rendered
 * @property {boolean}      required        - Whether a radio selection is mandatory
 * @property {boolean}      commentRequired - Whether the comment field is required
 * @property {string}       [category]      - Optional grouping label (e.g. 'Application Monitoring')
 * @property {string}       [helpText]      - Short contextual hint shown below the label
 */

// ── Form state ────────────────────────────────────────────────────────────────

/**
 * The answer state tracked per question inside the form.
 *
 * @typedef {Object} QuestionAnswer
 * @property {string}            questionId - Matches VerificationQuestion.id
 * @property {'yes'|'no'|''}    value      - Current radio selection
 * @property {string}            comment    - Free-text comment/remark
 */

/**
 * Top-level form state managed by useVerificationForm.
 *
 * @typedef {Object} VerificationFormState
 * @property {string}            headerComment - Top-level verification note
 * @property {QuestionAnswer[]}  answers       - Per-question answer state
 * @property {boolean}           isDirty       - True once any field has been touched
 */

/**
 * Validation error map — keyed by questionId or 'headerComment'.
 *
 * @typedef {Object.<string, string>} ValidationErrors
 */

// ── API payload & response ────────────────────────────────────────────────────

/**
 * Structured payload sent to POST /api/status-report/email.
 *
 * @typedef {Object} EmailReportPayload
 * @property {string}                  reportId      - UUID or timestamp-based ID
 * @property {string}                  timestamp     - ISO 8601 dispatch time
 * @property {string}                  submittedBy   - User identifier (display name or email)
 * @property {string}                  headerComment - Top-level verification note
 * @property {AnswerPayloadItem[]}     answers       - Array of answered questions
 */

/**
 * Individual answer item inside the email payload.
 *
 * @typedef {Object} AnswerPayloadItem
 * @property {string}           questionId    - Stable question identifier
 * @property {string}           questionLabel - Human-readable prompt (for email body readability)
 * @property {'yes'|'no'|''}   value         - Radio selection
 * @property {string}           comment       - Free-text comment (empty string when not provided)
 * @property {string|undefined} category      - Grouping label from the question definition
 */

/**
 * Shape returned by the email dispatch API endpoint on success.
 *
 * @typedef {Object} EmailDispatchResponse
 * @property {boolean} success   - Whether the email was dispatched without errors
 * @property {string}  message  - Human-readable status message
 * @property {string}  [emailId] - Server-assigned email tracking identifier
 */

// ── Hook return type ──────────────────────────────────────────────────────────

/**
 * Return type of useVerificationForm.
 *
 * @typedef {Object} UseVerificationFormReturn
 * @property {VerificationFormState}  formState       - Current form values
 * @property {ValidationErrors}       errors          - Active validation errors
 * @property {boolean}                isSubmitting    - True while the API call is in-flight
 * @property {boolean}                isSubmitSuccess - True after a successful submission
 * @property {string|null}            submitError     - Top-level submission error message
 * @property {function(string):void}  setHeaderComment - Update top-level note
 * @property {function(string, 'yes'|'no'):void} setAnswer   - Update a question's radio value
 * @property {function(string, string):void}     setComment  - Update a question's comment
 * @property {function():boolean}               validate    - Run validation; returns true if valid
 * @property {function():Promise<void>}          submit      - Validate + dispatch email
 * @property {function():void}                  reset       - Reset entire form to initial state
 */

// This file contains only JSDoc — no runtime exports needed.
export {};
