/**
 * index.js — public API for the EmailReportModule.
 *
 * External code (e.g. Dashboard.jsx) should import from this barrel export
 * rather than reaching into the module's internal file tree.
 *
 * Only the surface-area components intended for external use are exported here.
 * Internal helpers (question definitions, service, hook) remain encapsulated.
 */

export { EmailReportButton }   from './components/EmailReportButton';
export { VerificationModal }   from './components/VerificationModal';
export { EmailPreviewModal }   from './components/EmailPreviewModal';
// Hook and service exported for testing; not required by consumers.
export { useVerificationForm } from './hooks/useVerificationForm';
export { dispatchEmailReport, generateReportId } from './services/emailReportService';
export { VERIFICATION_QUESTIONS, groupQuestionsByCategory } from './services/verificationQuestions';
