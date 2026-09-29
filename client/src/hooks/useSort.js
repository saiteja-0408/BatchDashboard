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
 * @returns {{ sortedData, sortConfig, requestSort }}
 */
export function useSort(data) {
  // { key: string, direction: 'asc' | 'desc' } | null
  const [sortConfig, setSortConfig] = useState(null);

  /**
   * Cycles sort direction for the given column key:
   *   none → asc → desc → none
   */
  const requestSort = useCallback((key) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc')  return { key, direction: 'desc' };
      return null; // reset
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortConfig || !data) return data ?? [];
    return [...data].sort((a, b) =>
      compareValues(a[sortConfig.key], b[sortConfig.key], sortConfig.direction)
    );
  }, [data, sortConfig]);

  return { sortedData, sortConfig, requestSort };
}
