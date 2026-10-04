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
  // Treat nulls as smaller than everything
  if (a === null || a === undefined || a === '') return order === 'asc' ? 1 : -1;
  if (b === null || b === undefined || b === '') return order === 'asc' ? -1 : 1;

  // Date comparison
  const dateA = new Date(a);
  const dateB = new Date(b);
  if (!isNaN(dateA) && !isNaN(dateB)) {
    return order === 'asc' ? dateA - dateB : dateB - dateA;
  }

  // String comparison
  const sa = String(a).toLowerCase();
  const sb = String(b).toLowerCase();
  if (sa < sb) return order === 'asc' ? -1 : 1;
  if (sa > sb) return order === 'asc' ? 1 : -1;
  return 0;
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
 * Returns 'Biz Error', 'OK', or other string representation.
 * @param {object} row
 * @returns {string}
 */
export function getRowStatus(row) {
  if (!row) return '—';

  // Check explicit status strings (with case-insensitive / variation support)
  const explicitStatus = row.status ?? row._status;
  if (typeof explicitStatus === 'string') {
    const s = explicitStatus.trim().toLowerCase();
    if (s === 'biz error' || s === 'biz_error' || s === 'business error' || s === 'business_error') {
      return 'Biz Error';
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

  // Check flag fields (string, boolean, or number)
  const isFlagTrue = (val) => val === 'Y' || val === 'y' || val === '1' || val === 1 || val === true;
  if (
    isFlagTrue(row.biz_error_flag) ||
    isFlagTrue(row.biz_error) ||
    isFlagTrue(row.bizError) ||
    isFlagTrue(row.business_error_flag)
  ) {
    return 'Biz Error';
  }

  if (row.biz_error_flag === 'N' || row.biz_error_flag === 'n' || row.biz_error === 'N' || row.biz_error === 'n') {
    return 'OK';
  }

  return row.status ?? row._status ?? row.biz_error_flag ?? '—';
}

/**
 * Sorts status report rows prioritizing Biz Error.
 * Mode:
 *   'biz_top' / 'biz_top_asc' : Biz Errors top in original order, others in original order
 *   'default'                 : Original order (unmodified)
 * @param {Array<object>} rows
 * @param {'default'|'biz_top'|'biz_top_asc'|'biz_top_desc'} sortOrder
 * @returns {Array<object>}
 */
export function sortStatusRows(rows, sortOrder) {
  if (!rows || rows.length === 0 || !sortOrder || sortOrder === 'default') {
    return rows;
  }
  const bizErrors = [];
  const others = [];

  rows.forEach((row) => {
    if (getRowStatus(row) === 'Biz Error') {
      bizErrors.push(row);
    } else {
      others.push(row);
    }
  });

  if (sortOrder === 'biz_top_desc') {
    return [...bizErrors, ...[...others].reverse()];
  }

  // 'biz_top' / 'biz_top_asc'
  return [...bizErrors, ...others];
}
