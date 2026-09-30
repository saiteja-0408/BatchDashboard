/**
 * BatchContext.jsx — global context for batch data, search, and filter state.
 *
 * React Query handles server state (fetching, caching, revalidation).
 * This context holds the UI-level filter/search state, active sheet tab,
 * and the selected batch for the modal.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

const BatchContext = createContext(null);

/** Default empty filter state — all keys must be present so FilterPanel renders consistently. */
const DEFAULT_FILTERS = {
  frequency:     '',  // 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'biweekly' | 'on_demand' | ''
  scheduleValid: '',  // 'valid' | 'invalid' | ''
};

export function useBatchContext() {
  const ctx = useContext(BatchContext);
  if (!ctx) throw new Error('useBatchContext must be used within BatchProvider');
  return ctx;
}

export function BatchProvider({ children }) {
  const [searchQuery, setSearchQuery]     = useState('');
  // activeSheet: 'benefits' | 'tax' — drives the tab selector and API calls
  const [activeSheet, setActiveSheet]     = useState('benefits');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [isModalOpen, setIsModalOpen]     = useState(false);
  // Filter state: drives the FilterPanel dropdowns and filteredBatches logic
  const [filters, setFilters]             = useState(DEFAULT_FILTERS);

  const clearSearch = useCallback(() => setSearchQuery(''), []);

  /** Update a single filter key. Pass empty string '' to clear it. */
  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  /** Clear a single filter by key. */
  const clearFilter = useCallback((key) => {
    setFilters((prev) => ({ ...prev, [key]: '' }));
  }, []);

  /** Reset all filters and search. */
  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery('');
  }, []);

  const openBatchModal = useCallback((batch) => {
    setSelectedBatch(batch);
    setIsModalOpen(true);
  }, []);

  const closeBatchModal = useCallback(() => {
    setIsModalOpen(false);
    // Delay clearing selectedBatch so the modal close animation sees data
    setTimeout(() => setSelectedBatch(null), 300);
  }, []);

  // Reset filters when switching sheets so stale filter state doesn't carry over
  const handleSetActiveSheet = useCallback((sheet) => {
    setActiveSheet(sheet);
    setFilters(DEFAULT_FILTERS);
  }, []);

  return (
    <BatchContext.Provider
      value={{
        searchQuery, setSearchQuery, clearSearch,
        activeSheet, setActiveSheet: handleSetActiveSheet,
        selectedBatch, openBatchModal, closeBatchModal, isModalOpen,
        filters, updateFilter, clearFilter, clearAllFilters,
      }}
    >
      {children}
    </BatchContext.Provider>
  );
}

BatchProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
