/**
 * constants.js — all UI-level labels, API paths, and domain values.
 * Never hardcode strings in components — import from here.
 */

// ── API base — Vite proxies /api to backend in dev ──────────────────────────
export const API_BASE = '/api';

export const API_PATHS = {
  batches:       `${API_BASE}/batches`,
  summary:       `${API_BASE}/batches/summary`,
  search:        `${API_BASE}/batches/search`,
  filter:        `${API_BASE}/batches/filter`,
  batchById: (id) => `${API_BASE}/batches/${id}`,
  upload:        `${API_BASE}/upload`,
};

// ── Domain values (must match Excel data) ────────────────────────────────────
export const DOMAINS = ['Benefits', 'Tax'];
export const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Ad-hoc'];
export const STATUSES = ['Success', 'Failed', 'Running', 'Skipped'];
export const ENVIRONMENTS = ['DEV', 'QA', 'PROD'];

// ── Column display labels ─────────────────────────────────────────────────────
export const COLUMN_LABELS = {
  batchId:       'Batch ID',
  batchName:     'Batch Name',
  description:   'Description',
  domain:        'Domain',
  frequency:     'Frequency',
  scheduleTime:  'Schedule',
  lastRunTime:   'Last Run',
  nextRunTime:   'Next Run',
  lastRunStatus: 'Status',
  environment:   'Environment',
  ownerTeam:     'Owner Team',
  startCommand:  'Start Command',
  stopCommand:   'Stop Command',
  statusCommand: 'Status Command',
  logPath:       'Log Path',
  configPath:    'Config Path',
  notes:         'Notes',
  isActive:      'Active',
};

// ── Status colour mapping ─────────────────────────────────────────────────────
export const STATUS_COLORS = {
  Success: 'success',
  Failed:  'error',
  Running: 'info',
  Skipped: 'warning',
};

// ── Command categories for the Command Viewer ─────────────────────────────────
export const COMMAND_CATEGORIES = [
  { label: 'Start',  field: 'startCommand' },
  { label: 'Stop',   field: 'stopCommand' },
  { label: 'Status', field: 'statusCommand' },
  { label: 'Log',    field: 'logPath' },
  { label: 'Config', field: 'configPath' },
];

// ── Table: sortable column definitions ────────────────────────────────────────
export const SORTABLE_COLUMNS = [
  { id: 'batchId',       label: 'Batch ID' },
  { id: 'batchName',     label: 'Batch Name' },
  { id: 'domain',        label: 'Domain' },
  { id: 'frequency',     label: 'Frequency' },
  { id: 'scheduleTime',  label: 'Schedule' },
  { id: 'lastRunStatus', label: 'Status' },
  { id: 'lastRunTime',   label: 'Last Run' },
  { id: 'nextRunTime',   label: 'Next Run' },
  { id: 'environment',   label: 'Env' },
  { id: 'ownerTeam',     label: 'Team' },
];
