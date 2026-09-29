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
 * Exports an array of batch objects as a CSV file and triggers a browser download.
 * Uses no third-party library — generates a RFC 4180-compliant CSV via Blob.
 *
 * @param {Object[]} rows  - Array of batch objects
 * @param {string} filename - Output filename (without extension)
 */
export function exportToExcel(rows, filename = 'batches_export') {
  if (!rows || rows.length === 0) return;

  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Wrap in quotes if value contains comma, newline, or double-quote
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
