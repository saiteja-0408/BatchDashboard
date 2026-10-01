/**
 * BatchContext.jsx — two-context architecture for batch UI state.
 *
 * WHY TWO CONTEXTS?
 * -----------------
 * Previously a single context held ALL state (search, filters, activeSheet,
 * selectedBatch, isModalOpen). Every time a row was clicked, selectedBatch
 * and isModalOpen changed, which caused the single Provider value object to be
 * recreated, which triggered every consumer — including BatchTable (800+ rows)
 * — to re-render even though BatchTable does not care about the modal state.
 *
 * Split:
 *   BatchDataContext  — search, filters, activeSheet, openBatchModal reference.
 *                       Changes only on search/filter/tab events. BatchTable,
 *                       SearchBar, FilterPanel, SheetTabs subscribe here.
 *
 *   BatchModalContext — selectedBatch, isModalOpen, closeBatchModal.
 *                       Changes on every row click / modal close. ONLY
 *                       BatchDetailModal subscribes here.
 *
 * Both contexts are exported through the same BatchProvider so the JSX tree
 * in App.jsx does not need to change.
 *
 * WHY useReducer FOR MODAL STATE?
 * --------------------------------
 * The old openBatchModal called setSelectedBatch + setIsModalOpen as two
 * separate setState calls. Even with React 18 automatic batching, splitting
 * across two useState updaters in a useCallback can still schedule two
 * reconciliation passes. A single useReducer dispatch is always one pass.
 */

import React, {
  createContext, useContext, useState, useReducer, useCallback, useMemo,
} from 'react';
import PropTypes from 'prop-types';

// ── Context objects ───────────────────────────────────────────────────────────

const BatchDataContext  = createContext(null);
const BatchModalContext = createContext(null);

// ── Default filter state ──────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  frequency:     '',  // 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'biweekly' | 'on_demand' | ''
  scheduleValid: '',  // 'valid' | 'invalid' | ''
};

// ── Modal state reducer ───────────────────────────────────────────────────────
// Single dispatch instead of two sequential setState calls eliminates the
// extra render cycle that occurred between setSelectedBatch and setIsModalOpen.

const MODAL_INITIAL = { selectedBatch: null, isModalOpen: false };

function modalReducer(state, action) {
  switch (action.type) {
    case 'OPEN':
      return { selectedBatch: action.batch, isModalOpen: true };
    case 'CLOSE':
      return { ...state, isModalOpen: false };
    case 'CLEAR':
      return MODAL_INITIAL;
    default:
      return state;
  }
}

// ── Public hooks ──────────────────────────────────────────────────────────────

/**
 * Hook for components that need search/filter/sheet state and openBatchModal.
 * BatchTable, SearchBar, FilterPanel, SheetTabs, Dashboard use this.
 * Does NOT re-render when a row is clicked.
 */
export function useBatchContext() {
  const ctx = useContext(BatchDataContext);
  if (!ctx) throw new Error('useBatchContext must be used within BatchProvider');
  return ctx;
}

/**
 * Hook for BatchDetailModal only.
 * Re-renders only when selectedBatch or isModalOpen changes.
 */
export function useBatchModal() {
  const ctx = useContext(BatchModalContext);
  if (!ctx) throw new Error('useBatchModal must be used within BatchProvider');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function BatchProvider({ children }) {
  // ── Data / UI state (search, filters, active tab) ─────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSheet, setActiveSheet] = useState('benefits');
  const [filters, setFilters]         = useState(DEFAULT_FILTERS);

  // ── Modal state via reducer (single dispatch = single render pass) ─────────
  const [modalState, dispatchModal] = useReducer(modalReducer, MODAL_INITIAL);

  // ── Stable callbacks (data context) ───────────────────────────────────────
  const clearSearch = useCallback(() => setSearchQuery(''), []);

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

  const handleSetActiveSheet = useCallback((sheet) => {
    setActiveSheet(sheet);
    setFilters(DEFAULT_FILTERS);
  }, []);

  // openBatchModal is part of the DATA context so BatchTable can call it.
  // Its reference is stable — single useCallback, dispatches to the MODAL
  // reducer which lives in a separate context, so BatchTable does NOT re-render
  // when the modal opens.
  const openBatchModal = useCallback((batch) => {
    dispatchModal({ type: 'OPEN', batch });
  }, []);

  // ── Stable callbacks (modal context) ──────────────────────────────────────
  const closeBatchModal = useCallback(() => {
    dispatchModal({ type: 'CLOSE' });
    // Delay clearing selectedBatch so the modal close animation still sees data
    setTimeout(() => dispatchModal({ type: 'CLEAR' }), 300);
  }, []);

  // ── Memoised context values ────────────────────────────────────────────────
  // useMemo ensures the value object reference only changes when its own state
  // actually changes — prevents cascading re-renders.

  const dataValue = useMemo(() => ({
    searchQuery, setSearchQuery, clearSearch,
    activeSheet, setActiveSheet: handleSetActiveSheet,
    filters, updateFilter, clearFilter, clearAllFilters,
    openBatchModal,
  }), [
    searchQuery, clearSearch,
    activeSheet, handleSetActiveSheet,
    filters, updateFilter, clearFilter, clearAllFilters,
    openBatchModal,
  ]);

  const modalValue = useMemo(() => ({
    selectedBatch: modalState.selectedBatch,
    isModalOpen:   modalState.isModalOpen,
    closeBatchModal,
  }), [modalState, closeBatchModal]);

  return (
    <BatchDataContext.Provider value={dataValue}>
      <BatchModalContext.Provider value={modalValue}>
        {children}
      </BatchModalContext.Provider>
    </BatchDataContext.Provider>
  );
}

BatchProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
