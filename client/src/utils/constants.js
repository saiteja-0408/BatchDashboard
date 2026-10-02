/**
 * constants.js — all UI-level labels, API paths, domain values, and command logic.
 * Never hardcode strings in components — import from here.
 */

// ── API base — Vite proxies /api to backend in dev ──────────────────────────
export const API_BASE = '/api';

export const API_PATHS = {
  batches:          `${API_BASE}/batches`,
  summary:          `${API_BASE}/batches/summary`,
  search:           `${API_BASE}/batches/search`,
  filter:           `${API_BASE}/batches/filter`,
  // batchName must be URL-encoded by the caller
  batchByName: (name, sheet) =>
    `${API_BASE}/batches/${encodeURIComponent(name)}${sheet ? `?sheet=${sheet}` : ''}`,
  // Upload endpoint — sheet must be 'benefits' or 'tax'
  uploadSheet: (sheet) => `${API_BASE}/batches/upload/${sheet}`,
  // Current-tasks endpoint — polled every 60s from the BatchTable
  currentTasks: (sheet) => `${API_BASE}/current-tasks${sheet ? `?sheet=${sheet}` : ''}`,
  // Status report endpoint — live DB2 data for the Status Report tab
  statusReport: (force = false) => `${API_BASE}/status-report${force ? '?force=true' : ''}`,
};

/** Default auto-refresh interval for the current-tasks column (ms). */
export const CURRENT_TASKS_REFRESH_MS = 60_000;

// ── Sheet sources ─────────────────────────────────────────────────────────────
export const SHEET_SOURCES = ['status-report', 'benefits', 'tax'];

export const SHEET_LABELS = {
  benefits:        'Benefits',
  tax:             'Tax',
  'status-report': 'Status Report',
};

// ── Column display labels ─────────────────────────────────────────────────────
export const COLUMN_LABELS = {
  batchName:     'Batch Name',
  arguments:     'Arguments',
  scheduleName:  'Schedule Name / Job Group',
  triggerNeeded: 'Trigger Needed',
  sheetSource:   'Sheet',
  logDir:        'Log Directory',
  scheduleValid: 'Schedule Valid',
};

// ── Table: sortable column definitions ───────────────────────────────────────
// 'sheetSource' column removed — tab already indicates which sheet is active.
export const SORTABLE_COLUMNS = [
  { id: 'batchName',     label: 'Batch Name' },
  { id: 'scheduleName',  label: 'Schedule Name / Job Group' },
  { id: 'arguments',     label: 'Arguments' },
  { id: 'triggerNeeded', label: 'Trigger Needed' },
];

// ── Complete approved schedule name list (mirrors server/config/constants.js) ─
// Used client-side for the warning badge — must be kept in sync with the server.
export const VALID_SCHEDULE_NAMES = new Set([
  'MSAccess_reports_saturday_4am',
  'annual_recon_clearance_check_sch',
  'appeals_reports_145pm',
  'appeals_reports_615pm',
  'appeals_reports_830am',
  'benefits_biweekly_day_5am',
  'benefits_daily_0630pm',
  'benefits_daily_1030am',
  'benefits_daily_1140pm',
  'benefits_daily_11pm',
  'benefits_daily_12pm',
  'benefits_daily_12pm_top',
  'benefits_daily_3pm',
  'benefits_daily_4pm',
  'benefits_daily_515pm',
  'benefits_daily_5_15am',
  'benefits_daily_5am',
  'benefits_daily_5am_withHoliday',
  'benefits_daily_6am',
  'benefits_daily_730am',
  'benefits_daily_7am',
  'benefits_daily_815am',
  'benefits_daily_8am',
  'benefits_daily_915am',
  'benefits_daily_915pm',
  'benefits_daily_930am',
  'benefits_daily_930pm',
  'benefits_daily_9am',
  'benefits_daily_9pm',
  'benefits_daily_DCA_6am',
  'benefits_daily_sendtext_7am',
  'benefits_daily_sendtext_8am',
  'benefits_eb_monthly_10th_day_6am',
  'benefits_eb_qtrly_9th_day_530pm',
  'benefits_eb_weekly_sunday_3pm',
  'benefits_icon_export_10am',
  'benefits_icon_import_12pm',
  'benefits_monthly_10th_day_6am',
  'benefits_monthly_12th_day',
  'benefits_monthly_15th_day_6am',
  'benefits_monthly_17th_day',
  'benefits_monthly_1st_day_6am',
  'benefits_monthly_2nd_day',
  'benefits_monthly_2nd_monday_6am',
  'benefits_monthly_3rd_day_6am',
  'benefits_monthly_5th_day_9am',
  'benefits_monthly_6th_day_9am',
  'benefits_monthly_8th_day_6am',
  'benefits_monthly_8th_day_7pm',
  'benefits_monthly_9th_day_6am',
  'benefits_monthly_last_day_7pm',
  'benefits_peuc_qtrly_9th_day_530pm',
  'benefits_peuc_weekly_sunday_3pm',
  'benefits_qtrly_10th_day',
  'benefits_qtrly_15th_day',
  'benefits_qtrly_1st_day',
  'benefits_qtrly_1st_day_4_am',
  'benefits_qtrly_1st_day_of_3rd_Month',
  'benefits_qtrly_20th_day',
  'benefits_qtrly_20th_day_2nd_Month',
  'benefits_qtrly_3rd_day_1st_month_9am',
  'benefits_qtrly_5th_work_day',
  'benefits_qtrly_9th_day',
  'benefits_qtrly_9th_day_530pm',
  'benefits_qtrly_last_day_3pm',
  'benefits_qtrly_last_day_of_first_month',
  'benefits_qtrly_third_month_15th',
  'benefits_reports_7am',
  'benefits_sat_4am',
  'benefits_temp_claim_8pm',
  'benefits_tue_sat_6am',
  'benefits_weekly_1st_work_day330pm',
  'benefits_weekly_1st_work_day_7am',
  'benefits_weekly_friday_10pm',
  'benefits_weekly_friday_4pm',
  'benefits_weekly_friday_6am',
  'benefits_weekly_friday_730am',
  'benefits_weekly_friday_830pm',
  'benefits_weekly_friday_9pm',
  'benefits_weekly_monday_10am',
  'benefits_weekly_monday_515pm',
  'benefits_weekly_monday_6am',
  'benefits_weekly_saturday_6am',
  'benefits_weekly_saturday_8pm',
  'benefits_weekly_saturday_9pm',
  'benefits_weekly_sunday_1230am',
  'benefits_weekly_sunday_12pm',
  'benefits_weekly_sunday_3pm',
  'benefits_weekly_sunday_6pm',
  'benefits_weekly_sunday_9pm',
  'benefits_weekly_thursday_10pm',
  'benefits_weekly_thursday_12pm',
  'benefits_weekly_thursday_2pm',
  'benefits_weekly_thursday_9am',
  'benefits_weekly_tuesday_11am',
  'benefits_weekly_tuesday_5pm',
  'benefits_weekly_tuesday_6am',
  'benefits_weekly_wednesday_1030am',
  'benefits_weekly_wednesday_10am',
  'benefits_weekly_wednesday_6am',
  'corr_appeals',
  'corr_benefits',
  'corr_bpc_tra',
  'corr_dms',
  'corr_dms_morningrun',
  'corr_nonmon',
  'corr_webservice_twice_daily',
  'email_daily_2pm',
  'email_daily_5am',
  'eta_2nd_thursday_of_2ndMonth_of_quarter',
  'monthly_1st_Sunday',
  'monthly_1st_sunday',
  'on_demand',
  'reports_annual_july_1st',
  'reports_sat_7am',
  'special_holiday_12pm',
  'special_holiday_6pm',
  'top_annual_wednesday_12pm',
  'top_recert',
  'user_stat',
  'workflow_reports_530am',
  'workflow_reports_6am',
  'xmatch_1st_thursday_of_2ndMonth_of_quarter',
  'xmatch_2nd_thursday_of_1stMonth_of_quarter',
]);

/**
 * Builds the fully-formed run or resume command for a batch.
 *
 * Format:
 *   <logDir>
 *   sudo ./qclient.sh <action> <batchName> <scheduleName> ["<arguments>"]
 *
 * Arguments portion is omitted entirely when the arguments field is empty.
 *
 * @param {Object} batch   - BatchModel object
 * @param {'runJobOnly'|'resumeJob'} action
 * @returns {string}  Two-line command string (cd line + qclient line)
 */
export function buildCommand(batch, action) {
  const parts = [
    'sudo',
    './qclient.sh',
    action,
    batch.batchName,
    batch.scheduleName,
  ];
  // Only append arguments when non-empty
  if (batch.arguments && batch.arguments.trim()) {
    parts.push(`"${batch.arguments.trim()}"`);
  }
  return `${batch.logDir}\n${parts.join(' ')}`;
}
