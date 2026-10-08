/**
 * constants.js — all UI-level labels, API paths, domain values, and command logic.
 * Never hardcode strings in components — import from here.
 */

// ── UI timing constants ───────────────────────────────────────────────────────
/** Debounce delay (ms) applied to text-based filter/search inputs. */
export const DEBOUNCE_MS = 350;

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
  // Log fetch endpoint — SSHs into remote server and returns log tail as plain text
  batchLogs: (name, sheet, lines) => {
    const params = new URLSearchParams();
    if (sheet) params.set('sheet', sheet);
    if (lines) params.set('lines', String(lines));
    const qs = params.toString();
    return `${API_BASE}/batches/${encodeURIComponent(name)}/logs${qs ? `?${qs}` : ''}`;
  },
  // Upload endpoint — sheet must be 'benefits' or 'tax'
  uploadSheet: (sheet) => `${API_BASE}/batches/upload/${sheet}`,
  // Current-tasks endpoint — polled every 60s from the BatchTable
  currentTasks: (sheet) => `${API_BASE}/current-tasks${sheet ? `?sheet=${sheet}` : ''}`,
  // Status report endpoint — plain request served from server cache when warm
  statusReport: () => `${API_BASE}/status-report`,
  // Status report — ?fresh=true bypasses server cache and always hits the DB.
  // Used by the scheduled polling path so every interval tick gets live data.
  statusReportFresh: () => `${API_BASE}/status-report?fresh=true`,
};

/** Default auto-refresh interval for the current-tasks column (ms). */
export const CURRENT_TASKS_REFRESH_MS = 60_000;

/** Default and parsed polling interval for Status Report (ms). */
const DEFAULT_STATUS_REPORT_REFRESH_INTERVAL_MS = 10_000;

/**
 * Parses the VITE_STATUS_REPORT_REFRESH_INTERVAL_MS environment value.
 *
 * Return values:
 *   - Positive number  → polling interval in ms (e.g. 10000 = 10 s)
 *   - 0                → disable auto-polling (user explicitly opted out)
 *   - undefined/empty/NaN/negative → fall back to DEFAULT (10 s)
 *
 * @param {string|number|null|undefined} envVal
 * @returns {number}  Interval in ms, or 0 to disable polling
 */
export function parseStatusReportRefreshInterval(envVal) {
  // Absent or empty — use the safe default
  if (envVal === undefined || envVal === null || envVal === '') {
    return DEFAULT_STATUS_REPORT_REFRESH_INTERVAL_MS;
  }
  const parsed = Number(envVal);
  // Explicit 0 — operator wants to disable auto-polling
  if (parsed === 0) return 0;
  // Invalid or negative — fall back to default
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_STATUS_REPORT_REFRESH_INTERVAL_MS;
  }
  return parsed;
}

export const STATUS_REPORT_REFRESH_INTERVAL_MS = parseStatusReportRefreshInterval(
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_STATUS_REPORT_REFRESH_INTERVAL_MS || import.meta.env.REACT_APP_STATUS_REPORT_REFRESH_INTERVAL_MS)) ||
  (typeof process !== 'undefined' && process.env && (process.env.VITE_STATUS_REPORT_REFRESH_INTERVAL_MS || process.env.REACT_APP_STATUS_REPORT_REFRESH_INTERVAL_MS))
);

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
};

// ── Table: sortable column definitions ───────────────────────────────────────
// 'sheetSource' column removed — tab already indicates which sheet is active.
export const SORTABLE_COLUMNS = [
  { id: 'batchName',     label: 'Batch Name' },
  { id: 'scheduleName',  label: 'Schedule Name / Job Group' },
  { id: 'arguments',     label: 'Arguments' },
  { id: 'triggerNeeded', label: 'Trigger Needed' },
];


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

/**
 * Builds only the qclient.sh invocation line (without the cd prefix).
 * Used when the cd command is displayed separately as Option 1.
 *
 * @param {Object} batch
 * @param {'runJobOnly'|'resumeJob'} action
 * @returns {string}
 */
export function buildQclientLine(batch, action) {
  const parts = ['sudo', './qclient.sh', action, batch.batchName, batch.scheduleName];
  if (batch.arguments && batch.arguments.trim()) {
    parts.push(`"${batch.arguments.trim()}"`);
  }
  return parts.join(' ');
}

/**
 * Log path definitions per domain.
 * <batchName> is substituted at render time.
 *
 * Structure: { benefits: [{ label, path }], tax: [{ label, path }] }
 */
export const LOG_PATH_DEFS = {
  benefits: [
    {
      label: 'Benefits logs',
      path:  (batchName) => `/opt/app/accessms/bin/benefits/batch/logs/${batchName}`,
    },
    {
      label: 'Benefits logs archive',
      path:  (batchName) => `/opt/logs/Batch/archive/benefits/logs/${batchName}`,
    },
  ],
  tax: [
    {
      label: 'Tax logs',
      path:  (batchName) => `/opt/app/accessms/bin/tax/batch/logs/${batchName}`,
    },
    {
      label: 'Tax logs archive',
      path:  (batchName) => `/opt/logs/Batch/archive/tax/logs/${batchName}`,
    },
  ],
};
