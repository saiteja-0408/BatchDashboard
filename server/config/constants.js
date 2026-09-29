/**
 * constants.js — all shared server-side constants
 * No magic strings in controllers or services; import from here.
 */

const DOMAINS = ['Benefits', 'Tax'];
const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Ad-hoc'];
const STATUSES = ['Success', 'Failed', 'Running', 'Skipped'];
const ENVIRONMENTS = ['DEV', 'QA', 'PROD'];

/** Derived "active" status for summary cards */
const ACTIVE_STATUSES = ['Success', 'Running'];

module.exports = { DOMAINS, FREQUENCIES, STATUSES, ENVIRONMENTS, ACTIVE_STATUSES };
