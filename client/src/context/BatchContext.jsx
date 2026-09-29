/**
 * BatchContext.jsx — global context for batch data, search, and filter state.
 *
 * React Query handles server state (fetching, caching, revalidation).
 * This context holds the UI-level filter/search state and the selected batch.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

const BatchContext = createContext(null);

export function useBatchContext() {
  const ctx = useContext(BatchContext);
  if (!ctx) throw new Error('useBatchContext must be used within BatchProvider');
  return ctx;
}

const DEFAULT_FILTERS = {
  domain:    '',
  frequency: '',
  status:    '',
};

export function BatchProvider({ children }) {
  const [searchQuery, setSearchQuery]     = useState('');
  const [filters, setFilters]             = useState(DEFAULT_FILTERS);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [isModalOpen, setIsModalOpen]     = useState(false);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilter = useCallback((key) => {
    setFilters((prev) => ({ ...prev, [key]: '' }));
  }, []);

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

  return (
    <BatchContext.Provider
      value={{
        searchQuery, setSearchQuery,
        filters, updateFilter, clearFilter, clearAllFilters,
        selectedBatch, openBatchModal, closeBatchModal, isModalOpen,
      }}
    >
      {children}
    </BatchContext.Provider>
  );
}

BatchProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
