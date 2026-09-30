/**
 * mockData.js — realistic mock rows for GET /api/status-report.
 *
 * Used when USE_MOCK_DATA=true in .env or when DB2 credentials are absent.
 * Exercises every column type including error states, null values, and
 * parent-child job relationships so the UI table renders all code paths.
 *
 * Column schema mirrors db2prd1.T_Z_QRTZ_STATUS_REPORT exactly:
 *   job_name, job_group, start_time, end_time, next_fire_time,
 *   biz_error_flag, error_flag, killed_flag, parent_job_name, parent_job_group
 *
 * To switch to real DB2 on the target VM:
 *   1. Set DB2_HOST, DB2_DATABASE, DB2_USER, DB2_PASSWORD in .env
 *   2. Set USE_MOCK_DATA=false (or remove the line entirely)
 *   3. Run: npm install ibm_db
 *   No code changes required.
 */

'use strict';

const today = new Date();

/**
 * Returns a Date string offset from today's midnight by the given hours/minutes.
 * @param {number} h   — hours offset from midnight (can be negative = yesterday)
 * @param {number} [m=0] — minutes
 * @returns {string}   ISO timestamp string
 */
function ts(h, m = 0) {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  d.setHours(d.getHours() + h, d.getMinutes() + m);
  return d.toISOString();
}

/**
 * Mock status report rows — returned in ORDER BY start_time DESC order,
 * matching what the live DB2 query would return.
 *
 * @type {Array<{
 *   job_name: string,
 *   job_group: string,
 *   start_time: string,
 *   end_time: string|null,
 *   next_fire_time: string|null,
 *   biz_error_flag: 'Y'|'N',
 *   error_flag: 'Y'|'N',
 *   killed_flag: 'Y'|'N',
 *   parent_job_name: string|null,
 *   parent_job_group: string|null
 * }>}
 */
const MOCK_STATUS_REPORT_ROWS = [
  // ── Running now (no end_time yet) ───────────────────────────────────────────
  {
    job_name:         'BatchPayrollTaxCalc',
    job_group:        'benefits_daily_12pm',
    start_time:       ts(12, 0),
    end_time:         null,
    next_fire_time:   null,
    biz_error_flag:   'N',
    error_flag:       'N',
    killed_flag:      'N',
    parent_job_name:  null,
    parent_job_group: null,
  },
  // ── Business error (biz_error_flag = Y) ─────────────────────────────────────
  {
    job_name:         'BatchGetDd214Response',
    job_group:        'on_demand',
    start_time:       ts(10, 46),
    end_time:         ts(11, 17),
    next_fire_time:   null,
    biz_error_flag:   'Y',
    error_flag:       'N',
    killed_flag:      'N',
    parent_job_name:  null,
    parent_job_group: null,
  },
  // ── System error (error_flag = Y) ────────────────────────────────────────────
  {
    job_name:         'BatchFederalTaxDeposit',
    job_group:        'benefits_daily_730am',
    start_time:       ts(7, 30),
    end_time:         ts(7, 45),
    next_fire_time:   ts(31, 30),   // tomorrow
    biz_error_flag:   'N',
    error_flag:       'Y',
    killed_flag:      'N',
    parent_job_name:  null,
    parent_job_group: null,
  },
  // ── Killed job ───────────────────────────────────────────────────────────────
  {
    job_name:         'BatchW4ProcessingBatch',
    job_group:        'benefits_monthly_6th_day_9am',
    start_time:       ts(9, 0),
    end_time:         ts(9, 3),
    next_fire_time:   null,
    biz_error_flag:   'N',
    error_flag:       'Y',
    killed_flag:      'Y',
    parent_job_name:  null,
    parent_job_group: null,
  },
  // ── Successful completion ────────────────────────────────────────────────────
  {
    job_name:         'BatchEnrollmentSync',
    job_group:        'benefits_daily_6am',
    start_time:       ts(6, 0),
    end_time:         ts(6, 8),
    next_fire_time:   ts(30, 0),    // tomorrow 06:00
    biz_error_flag:   'N',
    error_flag:       'N',
    killed_flag:      'N',
    parent_job_name:  null,
    parent_job_group: null,
  },
  // ── Child job with parent reference ─────────────────────────────────────────
  {
    job_name:         'BatchDependentVerification',
    job_group:        'benefits_daily_930am',
    start_time:       ts(9, 30),
    end_time:         ts(9, 42),
    next_fire_time:   ts(33, 30),
    biz_error_flag:   'N',
    error_flag:       'N',
    killed_flag:      'N',
    parent_job_name:  'BatchEnrollmentSync',
    parent_job_group: 'benefits_daily_6am',
  },
  // ── Another successful benefits job ─────────────────────────────────────────
  {
    job_name:         'BatchEligibilityLoad',
    job_group:        'benefits_daily_8am',
    start_time:       ts(8, 0),
    end_time:         ts(8, 15),
    next_fire_time:   ts(32, 0),
    biz_error_flag:   'N',
    error_flag:       'N',
    killed_flag:      'N',
    parent_job_name:  null,
    parent_job_group: null,
  },
  // ── Tax domain — weekly job ──────────────────────────────────────────────────
  {
    job_name:         'BatchWithholdingReconcile',
    job_group:        'benefits_weekly_monday_515pm',
    start_time:       ts(17, 15),
    end_time:         ts(17, 52),
    next_fire_time:   ts(7 * 24 + 17, 15),   // next Monday
    biz_error_flag:   'N',
    error_flag:       'N',
    killed_flag:      'N',
    parent_job_name:  null,
    parent_job_group: null,
  },
  // ── Both biz_error and error flags set ──────────────────────────────────────
  {
    job_name:         'BatchStateTaxRemittance',
    job_group:        'benefits_daily_3pm',
    start_time:       ts(15, 0),
    end_time:         ts(15, 11),
    next_fire_time:   ts(39, 0),
    biz_error_flag:   'Y',
    error_flag:       'Y',
    killed_flag:      'N',
    parent_job_name:  null,
    parent_job_group: null,
  },
  // ── Ad-hoc / on-demand job ───────────────────────────────────────────────────
  {
    job_name:         'BatchACAReportingBuild',
    job_group:        'on_demand',
    start_time:       ts(5, 0),
    end_time:         ts(5, 55),
    next_fire_time:   null,
    biz_error_flag:   'N',
    error_flag:       'N',
    killed_flag:      'N',
    parent_job_name:  null,
    parent_job_group: null,
  },
];

module.exports = { MOCK_STATUS_REPORT_ROWS };
