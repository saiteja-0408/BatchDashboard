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
    label:           'Claimant Login',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-employer-login',
    label:           'Employer Login',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-internal-user-login',
    label:           'Internal User Login',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-sso',
    label:           'SSO',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-my-q',
    label:           'My Q',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-claimant-inquiry',
    label:           'Claimant Inquiry',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-view-correspondence-claimant',
    label:           'View Correspondence for Claimant',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-employer-inquiry',
    label:           'Employer Inquiry',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-view-correspondence-employer',
    label:           'View Correspondence for Employer',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-mobile-app-check',
    label:           'Mobile App Check',
    type:            'text-only',
    required:        false,
    commentRequired: false,
    category:        'Application Monitoring',
    helpText:        'NOTE - This validation is no longer applicable and can be disregarded.',
  },
  {
    id:              'app-chatbot-check',
    label:           'Chatbot Check',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
  },
  {
    id:              'app-failed-kafka-records',
    label:           'Failed Kafka Records',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Application Monitoring',
    helpText:        'Select YES/NO and attach Jira ticket link if present.',
  },

  // ── Database Monitoring ──────────────────────────────────────────────────
  {
    id:              'db-claim-filing',
    label:           'Claim Filing',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Database Monitoring',
  },
  {
    id:              'db-weekly-cert-filing',
    label:           'Weekly Cert Filing',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Database Monitoring',
  },

  // ── Batch Monitoring ─────────────────────────────────────────────────────
  {
    id:              'batch-monitoring-execution',
    label:           'Monitoring batches Execution',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Batch Monitoring',
  },
  {
    id:              'batch-hung',
    label:           'Any Hung Batch',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Batch Monitoring',
    helpText:        'Select YES/NO and describe any hung batches.',
  },
  {
    id:              'batch-failed',
    label:           'Any Failed Batches',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Batch Monitoring',
    helpText:        'Select YES/NO and list failed batches with ticket URLs.',
  },
  {
    id:              'batch-correspondence-temp-clean',
    label:           'Correspondence Temp Table Clean',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'Batch Monitoring',
  },

  // ── RPA (BOT) Run ────────────────────────────────────────────────────────
  {
    id:              'rpa-ib6-incoming',
    label:           'IB6 incoming Process',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'RPA (BOT) Run',
  },
  {
    id:              'rpa-work-item-assign',
    label:           'Work item assign',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'RPA (BOT) Run',
  },
  {
    id:              'rpa-name-mismatch',
    label:           'Name mismatch',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'RPA (BOT) Run',
  },
  {
    id:              'rpa-incorrect-wage',
    label:           'Incorrect Wage',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'RPA (BOT) Run',
  },
  {
    id:              'rpa-process-employer-response',
    label:           'Process Employer Response',
    type:            'yes-no-comment',
    required:        true,
    commentRequired: false,
    category:        'RPA (BOT) Run',
  },
  {
    id:              'rpa-workitem-reassign',
    label:           'WorkItem Reassign',
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
