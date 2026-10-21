/**
 * verificationQuestions.js — static questionnaire definition for the
 * "Email Status Report" verification modal.
 *
 * These questions mirror the MS Daily Health Check Activities checklist
 * (Application Monitoring, Database Monitoring, Batch Monitoring, RPA BOT Run).
 *
 * Shape per item: VerificationQuestion (see types/emailReport.types.js)
 *
 * To add / remove questions, edit this array only — no component changes needed.
 */

/** @type {import('../types/emailReport.types').VerificationQuestion[]} */
export const VERIFICATION_QUESTIONS = [
  // ── Application Monitoring ───────────────────────────────────────────────
  {
    id:              'app-claimant-login',
    label:           'Claimant Login is operational',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-employer-login',
    label:           'Employer Login is operational',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-internal-user-login',
    label:           'Internal User Login is operational',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-sso',
    label:           'SSO (Single Sign-On) is functioning correctly',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-my-q',
    label:           'My Q is accessible and working',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-claimant-inquiry',
    label:           'Claimant Inquiry is operational',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-view-correspondence-claimant',
    label:           'View Correspondence for Claimant is working',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-employer-inquiry',
    label:           'Employer Inquiry is operational',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-view-correspondence-employer',
    label:           'View Correspondence for Employer is working',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-chatbot-check',
    label:           'Chatbot is responding correctly',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-failed-kafka-records',
    label:           'No failed Kafka records detected (attach ticket if present)',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
    helpText:        'Answer "No" and provide the ticket URL if failed records exist.',
  },

  // ── Database Monitoring ──────────────────────────────────────────────────
  {
    id:              'db-claim-filing',
    label:           'Claim Filing database operations are healthy',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Database Monitoring',
  },
  {
    id:              'db-weekly-cert-filing',
    label:           'Weekly Cert Filing database operations are healthy',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Database Monitoring',
  },

  // ── Batch Monitoring ─────────────────────────────────────────────────────
  {
    id:              'batch-monitoring-execution',
    label:           'All monitoring batches executed successfully',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Batch Monitoring',
  },
  {
    id:              'batch-hung',
    label:           'No hung batches detected',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Batch Monitoring',
    helpText:        'Answer "No" and describe any hung batches in the comment.',
  },
  {
    id:              'batch-failed',
    label:           'No failed batches detected',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Batch Monitoring',
    helpText:        'Answer "No" and list any failed batches in the comment.',
  },
  {
    id:              'batch-correspondence-temp-clean',
    label:           'Correspondence Temp Table clean-up completed successfully',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Batch Monitoring',
  },

  // ── RPA (BOT) Run ────────────────────────────────────────────────────────
  {
    id:              'rpa-ib6-incoming',
    label:           'IB6 Incoming Process completed successfully',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'RPA (BOT) Run',
  },
  {
    id:              'rpa-work-item-assign',
    label:           'Work Item Assign process completed successfully',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'RPA (BOT) Run',
  },
  {
    id:              'rpa-name-mismatch',
    label:           'Name Mismatch process completed successfully',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'RPA (BOT) Run',
  },
  {
    id:              'rpa-incorrect-wage',
    label:           'Incorrect Wage process completed successfully',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'RPA (BOT) Run',
  },
  {
    id:              'rpa-process-employer-response',
    label:           'Process Employer Response completed successfully',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'RPA (BOT) Run',
  },
  {
    id:              'rpa-workitem-reassign',
    label:           'WorkItem Reassign process completed successfully',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'RPA (BOT) Run',
  },
];

/**
 * Returns questions grouped by their category.
 * Preserves insertion order — categories appear in the order their first
 * question was encountered in VERIFICATION_QUESTIONS.
 *
 * @returns {Map<string, import('../types/emailReport.types').VerificationQuestion[]>}
 */
export function groupQuestionsByCategory() {
  /** @type {Map<string, import('../types/emailReport.types').VerificationQuestion[]>} */
  const map = new Map();
  for (const q of VERIFICATION_QUESTIONS) {
    const cat = q.category ?? 'General';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(q);
  }
  return map;
}
