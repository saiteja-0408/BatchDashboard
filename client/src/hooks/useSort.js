/**
 * useSort.js — per-scope sort state with a three-state cycle.
 *
 * Cycle per column: none → asc → desc → none (reset).
 * This matches the StatusReportTab behavior and gives users a way to return
 * to the original server/upload order.
 *
 * Scope keys (e.g. 'benefits' | 'tax') keep each sheet's sort config independent
 * so switching tabs does not reset the sort the user selected on the other tab.
 */

import { useState, useCallback, useMemo } from 'react';
import { compareValues } from '../utils/helpers';

/**
 * Computes the next sort config for a column within the three-state cycle:
 *   no sort → asc → desc → no sort
 *
 * @param {{ key: string, direction: 'asc'|'desc' } | null} current
 * @param {string} key  Column key being clicked
 * @returns {{ key: string, direction: 'asc'|'desc' } | null}
 */
function nextConfig(current, key) {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc')     return { key, direction: 'desc' };
  // desc → reset (returns to original server order)
  return null;
}

/**
 * @param {Object[]} data       - Array of objects to sort
 * @param {string} [scopeKey]   - Optional sheet scope ('benefits' | 'tax') to keep sort
 *                                configs independent across tabs
 * @returns {{ sortedData: Object[], sortConfig: {key:string, direction:string}|null, requestSort: function }}
 */
export function useSort(data, scopeKey) {
  // Map of scopeKey → { key: string, direction: 'asc' | 'desc' } | null
  const [sortConfigs, setSortConfigs] = useState({});

  const activeScope = scopeKey || '_default';
  const sortConfig  = sortConfigs[activeScope] ?? null;

  /**
   * Cycles the sort direction for the given column key in the current scope:
   *   none → asc → desc → none
   */
  const requestSort = useCallback((key) => {
    setSortConfigs((prev) => ({
      ...prev,
      [activeScope]: nextConfig(prev[activeScope] ?? null, key),
    }));
  }, [activeScope]);

  const sortedData = useMemo(() => {
    if (!data) return [];
    if (!sortConfig) return data;
    // Always sort a shallow copy — never mutate the original data array.
    return [...data].sort((a, b) =>
      compareValues(a[sortConfig.key], b[sortConfig.key], sortConfig.direction)
    );
  }, [data, sortConfig]);

  return { sortedData, sortConfig, requestSort };
}
