/**
 * batchSorting.test.js — unit tests for table sorting comparator and logic
 * used by Benefits and Tax sheets.
 */

'use strict';

// CommonJS implementation mirroring client/src/utils/helpers.js compareValues
function compareValues(a, b, order = 'asc') {
  if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) return 0;
  if (a === null || a === undefined || a === '') return order === 'asc' ? 1 : -1;
  if (b === null || b === undefined || b === '') return order === 'asc' ? -1 : 1;

  const numA = typeof a === 'number' ? a : (typeof a === 'string' && a.trim() !== '' && !isNaN(Number(a)) ? Number(a) : NaN);
  const numB = typeof b === 'number' ? b : (typeof b === 'string' && b.trim() !== '' && !isNaN(Number(b)) ? Number(b) : NaN);
  if (!isNaN(numA) && !isNaN(numB)) {
    return order === 'asc' ? numA - numB : numB - numA;
  }

  if (a instanceof Date && b instanceof Date) {
    return order === 'asc' ? a.getTime() - b.getTime() : b.getTime() - a.getTime();
  }

  const sa = String(a);
  const sb = String(b);
  const comp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
  return order === 'asc' ? comp : -comp;
}

function requestSort(currentConfig, key) {
  if (!currentConfig || currentConfig.key !== key) return { key, direction: 'asc' };
  if (currentConfig.direction === 'asc') return { key, direction: 'desc' };
  return { key, direction: 'asc' };
}

function requestScopedSort(configs, scope, key) {
  const current = configs[scope];
  if (!current || current.key !== key) {
    return { ...configs, [scope]: { key, direction: 'asc' } };
  }
  if (current.direction === 'asc') {
    return { ...configs, [scope]: { key, direction: 'desc' } };
  }
  return { ...configs, [scope]: { key, direction: 'asc' } };
}

describe('compareValues helper', () => {
  describe('Ascending order (order="asc")', () => {
    test('sorts string values case-insensitively and naturally', () => {
      expect(compareValues('Alpha', 'beta', 'asc')).toBeLessThan(0);
      expect(compareValues('beta', 'Alpha', 'asc')).toBeGreaterThan(0);
      expect(compareValues('Batch_1', 'batch_2', 'asc')).toBeLessThan(0);
      expect(compareValues('Batch_10', 'batch_2', 'asc')).toBeGreaterThan(0);
      expect(compareValues('same', 'SAME', 'asc')).toBe(0);
    });

    test('sorts numeric values correctly', () => {
      expect(compareValues(5, 10, 'asc')).toBeLessThan(0);
      expect(compareValues(10, 5, 'asc')).toBeGreaterThan(0);
      expect(compareValues(10, 10, 'asc')).toBe(0);
      expect(compareValues('5', '10', 'asc')).toBeLessThan(0);
      expect(compareValues('10', '2', 'asc')).toBeGreaterThan(0);
    });

    test('treats null/undefined/empty string as smaller than valid values', () => {
      expect(compareValues(null, 'BatchA', 'asc')).toBeGreaterThan(0);
      expect(compareValues('BatchA', null, 'asc')).toBeLessThan(0);
      expect(compareValues(undefined, 'BatchA', 'asc')).toBeGreaterThan(0);
      expect(compareValues('', 'BatchA', 'asc')).toBeGreaterThan(0);
      expect(compareValues(null, undefined, 'asc')).toBe(0);
      expect(compareValues('', '', 'asc')).toBe(0);
    });
  });

  describe('Descending order (order="desc")', () => {
    test('sorts string values in reverse order', () => {
      expect(compareValues('Alpha', 'beta', 'desc')).toBeGreaterThan(0);
      expect(compareValues('beta', 'Alpha', 'desc')).toBeLessThan(0);
      expect(compareValues('Batch_10', 'batch_2', 'desc')).toBeLessThan(0);
    });

    test('sorts numeric values in reverse order', () => {
      expect(compareValues(5, 10, 'desc')).toBeGreaterThan(0);
      expect(compareValues(10, 5, 'desc')).toBeLessThan(0);
    });

    test('treats null/undefined/empty string in descending order', () => {
      expect(compareValues(null, 'BatchA', 'desc')).toBeLessThan(0);
      expect(compareValues('BatchA', null, 'desc')).toBeGreaterThan(0);
      expect(compareValues(null, null, 'desc')).toBe(0);
    });
  });

  describe('Sorting array of batches', () => {
    const mockBatches = [
      { batchName: 'ClaimProcess', scheduleName: 'benefits_daily_5am', arguments: 'mode=full', triggerNeeded: 'Y' },
      { batchName: 'AppealsDaily', scheduleName: 'appeals_reports_830am', arguments: '', triggerNeeded: 'N' },
      { batchName: 'BenefitRecon', scheduleName: 'benefits_monthly_1st_day_6am', arguments: 'force=true', triggerNeeded: 'Y' },
      { batchName: 'Z_AuditJob', scheduleName: 'benefits_daily_11pm', arguments: null, triggerNeeded: '' },
    ];

    test('sorts by batchName ascending and descending', () => {
      const asc = [...mockBatches].sort((a, b) => compareValues(a.batchName, b.batchName, 'asc'));
      expect(asc.map(b => b.batchName)).toEqual(['AppealsDaily', 'BenefitRecon', 'ClaimProcess', 'Z_AuditJob']);

      const desc = [...mockBatches].sort((a, b) => compareValues(a.batchName, b.batchName, 'desc'));
      expect(desc.map(b => b.batchName)).toEqual(['Z_AuditJob', 'ClaimProcess', 'BenefitRecon', 'AppealsDaily']);
    });

    test('sorts by triggerNeeded with empty values placed last', () => {
      const asc = [...mockBatches].sort((a, b) => compareValues(a.triggerNeeded, b.triggerNeeded, 'asc'));
      expect(asc.map(b => b.triggerNeeded)).toEqual(['N', 'Y', 'Y', '']);
    });
  });

  describe('requestSort state transitions', () => {
    test('cycles ascending → descending → ascending on same column', () => {
      let sort = null;
      sort = requestSort(sort, 'batchName');
      expect(sort).toEqual({ key: 'batchName', direction: 'asc' });

      sort = requestSort(sort, 'batchName');
      expect(sort).toEqual({ key: 'batchName', direction: 'desc' });

      sort = requestSort(sort, 'batchName');
      expect(sort).toEqual({ key: 'batchName', direction: 'asc' });
    });

    test('switches to new column resetting direction to ascending', () => {
      let sort = { key: 'batchName', direction: 'desc' };
      sort = requestSort(sort, 'scheduleName');
      expect(sort).toEqual({ key: 'scheduleName', direction: 'asc' });
    });

    test('preserves independent sort configs across sheet tabs', () => {
      let configs = {};
      configs = requestScopedSort(configs, 'benefits', 'batchName');
      configs = requestScopedSort(configs, 'tax', 'scheduleName');
      expect(configs.benefits).toEqual({ key: 'batchName', direction: 'asc' });
      expect(configs.tax).toEqual({ key: 'scheduleName', direction: 'asc' });

      configs = requestScopedSort(configs, 'benefits', 'batchName');
      expect(configs.benefits).toEqual({ key: 'batchName', direction: 'desc' });
      expect(configs.tax).toEqual({ key: 'scheduleName', direction: 'asc' });

      configs = requestScopedSort(configs, 'benefits', 'batchName');
      expect(configs.benefits).toEqual({ key: 'batchName', direction: 'asc' });
      expect(configs.tax).toEqual({ key: 'scheduleName', direction: 'asc' });
    });
  });
});
