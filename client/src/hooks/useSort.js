/**
 * useSort.js — reusable multi-column sort state hook.
 *
 * Returns the current sort config and a handler to cycle through
 * asc → desc → none for each column.
 */

import { useState, useCallback, useMemo } from 'react';
import { compareValues } from '../utils/helpers';

/**
 * @param {Object[]} data  - Array of objects to sort
 * @param {string} [scopeKey] - Optional sheet scope (e.g. 'benefits' | 'tax') to preserve per-sheet sort configs
 * @returns {{ sortedData, sortConfig, requestSort }}
 */
export function useSort(data, scopeKey) {
  // Map of scopeKey -> { key: string, direction: 'asc' | 'desc' }
  const [sortConfigs, setSortConfigs] = useState({});

  const activeScope = scopeKey || '_default';
  const sortConfig = sortConfigs[activeScope] || null;

  /**
   * Toggles sort direction for the given column key in the current scope:
   *   - Clicking a new column sets direction to 'asc'
   *   - Clicking the active column toggles between 'asc' and 'desc'
   */
  const requestSort = useCallback((key) => {
    setSortConfigs((prev) => {
      const current = prev[activeScope];
      const next = (!current || current.key !== key)
        ? { key, direction: 'asc' }
        : { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      return { ...prev, [activeScope]: next };
    });
  }, [activeScope]);

  const sortedData = useMemo(() => {
    if (!sortConfig || !data) return data ?? [];
    return [...data].sort((a, b) =>
      compareValues(a[sortConfig.key], b[sortConfig.key], sortConfig.direction)
    );
  }, [data, sortConfig]);

  return { sortedData, sortConfig, requestSort };
}
