/**
 * helpers.js — pure utility functions used across the UI.
 */

/**
 * Formats an ISO date string or raw date value for display.
 * Returns '—' for empty/null values.
 * @param {string|null} value
 * @returns {string}
 */
export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value; // Return as-is if not parseable
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Compares two values for table sorting.
 * Handles strings (case-insensitive), dates, and numbers.
 * @param {*} a
 * @param {*} b
 * @param {'asc'|'desc'} order
 * @returns {number}
 */
export function compareValues(a, b, order = 'asc') {
  // Treat null / undefined / empty string as smaller than everything
  if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) return 0;
  if (a === null || a === undefined || a === '') return order === 'asc' ? 1 : -1;
  if (b === null || b === undefined || b === '') return order === 'asc' ? -1 : 1;

  // Numeric comparison if both values are numbers (or numeric strings)
  const numA = typeof a === 'number' ? a : (typeof a === 'string' && a.trim() !== '' && !isNaN(Number(a)) ? Number(a) : NaN);
  const numB = typeof b === 'number' ? b : (typeof b === 'string' && b.trim() !== '' && !isNaN(Number(b)) ? Number(b) : NaN);
  if (!isNaN(numA) && !isNaN(numB)) {
    return order === 'asc' ? numA - numB : numB - numA;
  }

  // Date comparison for Date objects or ISO/date formatted strings only
  if (a instanceof Date && b instanceof Date) {
    return order === 'asc' ? a.getTime() - b.getTime() : b.getTime() - a.getTime();
  }

  // String natural / case-insensitive comparison
  const sa = String(a);
  const sb = String(b);
  const comp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
  return order === 'asc' ? comp : -comp;
}

/**
 * Copies text to the clipboard.
 * Falls back silently if clipboard API is unavailable.
 * @param {string} text
 * @returns {Promise<boolean>} true if successful
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to determine status string for a row.
 *
 * Priority evaluation order:
 *   1. error_flag = 'Y' (case-insensitive)  → "Batch Failed"
 *   2. biz_error_flag truthy                → "Biz Error"
 *   3. Default / standard mapping           → "OK", explicit status string, or '—'
 *
 * @param {object} row
 * @returns {string}
 */
export function getRowStatus(row) {
  if (!row) return '—';

  // ── Priority 1: error_flag = 'Y' → Batch Failed ──────────────────────────
  const isFlagTrue = (val) => val === 'Y' || val === 'y' || val === '1' || val === 1 || val === true;
  if (isFlagTrue(row.error_flag)) {
    return 'Batch Failed';
  }

  // ── Priority 2: biz_error_flag truthy → Biz Error ────────────────────────
  if (
    isFlagTrue(row.biz_error_flag) ||
    isFlagTrue(row.biz_error) ||
    isFlagTrue(row.bizError) ||
    isFlagTrue(row.business_error_flag)
  ) {
    return 'Biz Error';
  }

  // ── Priority 3: default / standard mapping ────────────────────────────────

  // Check explicit status strings (with case-insensitive / variation support)
  const explicitStatus = row.status ?? row._status;
  if (typeof explicitStatus === 'string') {
    const s = explicitStatus.trim().toLowerCase();
    if (s === 'biz error' || s === 'biz_error' || s === 'business error' || s === 'business_error') {
      return 'Biz Error';
    }
    if (s === 'batch failed' || s === 'batch_failed' || s === 'failed') {
      return 'Batch Failed';
    }
    if (s === 'ok' || s === 'success' || s === 'complete' || s === 'completed') {
      return 'OK';
    }
    if (explicitStatus.trim()) {
      return explicitStatus.trim();
    }
  }

  // Check error message / description fields indicating business error
  const errorMsg = row.error_message || row.errorMessage || row.error || row.error_desc || row.errorDescription;
  if (typeof errorMsg === 'string') {
    const errLower = errorMsg.toLowerCase();
    if (errLower.includes('biz error') || errLower.includes('business error') || errLower.includes('biz_error')) {
      return 'Biz Error';
    }
  }

  if (row.biz_error_flag === 'N' || row.biz_error_flag === 'n' || row.biz_error === 'N' || row.biz_error === 'n') {
    return 'OK';
  }

  return row.status ?? row._status ?? row.biz_error_flag ?? '—';
}

/**
 * Sorts status report rows with the prioritized status ordering:
 *   1. "Batch Failed" rows first (stable — original arrival order preserved)
 *   2. "Biz Error" rows next (stable)
 *   3. All remaining statuses in their original order
 *
 * Mode:
 *   'priority_top' / 'biz_top' / 'biz_top_asc' : apply priority order
 *   'priority_top_desc' / 'biz_top_desc'        : priority order, others reversed
 *   'default'                                   : original order (unmodified)
 *
 * @param {Array<object>} rows
 * @param {'default'|'priority_top'|'biz_top'|'biz_top_asc'|'priority_top_desc'|'biz_top_desc'} sortOrder
 * @returns {Array<object>}
 */
export function sortStatusRows(rows, sortOrder) {
  if (!rows || rows.length === 0 || !sortOrder || sortOrder === 'default') {
    return rows;
  }
  const batchFailed = [];
  const bizErrors   = [];
  const others      = [];

  rows.forEach((row) => {
    const status = getRowStatus(row);
    if (status === 'Batch Failed') {
      batchFailed.push(row);
    } else if (status === 'Biz Error') {
      bizErrors.push(row);
    } else {
      others.push(row);
    }
  });

  const isDesc = sortOrder === 'priority_top_desc' || sortOrder === 'biz_top_desc';
  const tail = isDesc ? [...others].reverse() : others;
  return [...batchFailed, ...bizErrors, ...tail];
}
