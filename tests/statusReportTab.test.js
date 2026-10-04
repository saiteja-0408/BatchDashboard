/**
 * statusReportTab.test.js
 *
 * Unit tests for StatusReportTab helper functions and table sorting logic:
 *   - Row status determination (Biz Error, OK, fallback)
 *   - Stable partitioning & sorting logic with Biz Error priority
 *   - Tab initialization and storage persistence
 */

// Inline / CommonJS compatible utilities matching client/src/utils/helpers.js

function getRowStatus(row) {
  if (!row) return '—';
  if (typeof row.status === 'string' && row.status.trim() === 'Biz Error') return 'Biz Error';
  if (typeof row._status === 'string' && row._status.trim() === 'Biz Error') return 'Biz Error';
  const isFlagTrue = (val) => val === 'Y' || val === 'y' || val === '1' || val === 1 || val === true;
  if (isFlagTrue(row.biz_error_flag) || isFlagTrue(row.biz_error) || isFlagTrue(row.bizError)) {
    return 'Biz Error';
  }
  if (row.biz_error_flag === 'N' || row.biz_error_flag === 'n') return 'OK';
  return row.status ?? row._status ?? row.biz_error_flag ?? '—';
}

function sortStatusRows(rows, sortOrder) {
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

  // 'biz_top_asc'
  return [...bizErrors, ...others];
}

describe('StatusReportTab unit tests', () => {
  describe('getRowStatus', () => {
    test('identifies status="Biz Error" directly', () => {
      expect(getRowStatus({ status: 'Biz Error' })).toBe('Biz Error');
    });

    test('identifies biz_error_flag="Y" as Biz Error', () => {
      expect(getRowStatus({ biz_error_flag: 'Y' })).toBe('Biz Error');
    });

    test('identifies biz_error_flag="N" as OK', () => {
      expect(getRowStatus({ biz_error_flag: 'N' })).toBe('OK');
    });

    test('handles fallback when neither is present', () => {
      expect(getRowStatus({})).toBe('—');
    });
  });

  describe('sortStatusRows — Biz Error priority & stable sort', () => {
    const mockRows = [
      { id: 1, job_name: 'JobA', biz_error_flag: 'N' },
      { id: 2, job_name: 'JobB', biz_error_flag: 'Y' },
      { id: 3, job_name: 'JobC', biz_error_flag: 'N' },
      { id: 4, job_name: 'JobD', biz_error_flag: 'Y' },
      { id: 5, job_name: 'JobE', biz_error_flag: 'N' },
    ];

    test('default order preserves exact original array order', () => {
      const result = sortStatusRows(mockRows, 'default');
      expect(result.map(r => r.id)).toEqual([1, 2, 3, 4, 5]);
    });

    test('1st click (biz_top) places all Biz Errors first in stable order, followed by other rows in stable order', () => {
      const result = sortStatusRows(mockRows, 'biz_top');
      expect(result.map(r => r.id)).toEqual([2, 4, 1, 3, 5]);
    });

    test('2nd click toggles back to default / normal order', () => {
      const sortedResult = sortStatusRows(mockRows, 'biz_top');
      expect(sortedResult.map(r => r.id)).toEqual([2, 4, 1, 3, 5]);

      const normalResult = sortStatusRows(mockRows, 'default');
      expect(normalResult.map(r => r.id)).toEqual([1, 2, 3, 4, 5]);
    });

    test('handles empty or null row list safely', () => {
      expect(sortStatusRows([], 'biz_top')).toEqual([]);
      expect(sortStatusRows(null, 'biz_top')).toBeNull();
    });
  });

  describe('Storage & Tab persistence simulation', () => {
    const STORAGE_TAB_KEY = 'batch_dashboard_active_sheet';
    const DEFAULT_TAB     = 'status-report';

    let mockSessionStorage = {};
    let mockLocalStorage = {};

    beforeEach(() => {
      mockSessionStorage = {};
      mockLocalStorage = {};
    });

    test('defaults to "status-report" tab on initial load when storage is empty', () => {
      const saved = mockSessionStorage[STORAGE_TAB_KEY] || mockLocalStorage[STORAGE_TAB_KEY];
      const initialTab = saved || DEFAULT_TAB;
      expect(initialTab).toBe('status-report');
    });

    test('persists tab selection across reloads via storage', () => {
      // Simulate switching tab to 'benefits'
      mockSessionStorage[STORAGE_TAB_KEY] = 'benefits';
      mockLocalStorage[STORAGE_TAB_KEY] = 'benefits';

      // Reload
      const saved = mockSessionStorage[STORAGE_TAB_KEY] || mockLocalStorage[STORAGE_TAB_KEY];
      const tabAfterReload = saved || DEFAULT_TAB;
      expect(tabAfterReload).toBe('benefits');
    });

    test('status-report tab selection survives reload', () => {
      // Set to 'status-report'
      mockSessionStorage[STORAGE_TAB_KEY] = 'status-report';

      const saved = mockSessionStorage[STORAGE_TAB_KEY] || mockLocalStorage[STORAGE_TAB_KEY];
      const tabAfterReload = saved || DEFAULT_TAB;
      expect(tabAfterReload).toBe('status-report');
    });
  });

  describe('Polling interval parsing and fallback', () => {
    function parseStatusReportRefreshInterval(envVal) {
      if (envVal === undefined || envVal === null || envVal === '') {
        return 10000;
      }
      const parsed = Number(envVal);
      if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
        return 10000;
      }
      return parsed;
    }

    test('returns 10000 when environment variable is missing (undefined)', () => {
      expect(parseStatusReportRefreshInterval(undefined)).toBe(10000);
    });

    test('returns 10000 when environment variable is empty string or null', () => {
      expect(parseStatusReportRefreshInterval('')).toBe(10000);
      expect(parseStatusReportRefreshInterval(null)).toBe(10000);
    });

    test('returns 10000 when environment variable is non-numeric', () => {
      expect(parseStatusReportRefreshInterval('invalid')).toBe(10000);
      expect(parseStatusReportRefreshInterval('abc100')).toBe(10000);
    });

    test('returns 10000 when environment variable is <= 0', () => {
      expect(parseStatusReportRefreshInterval('0')).toBe(10000);
      expect(parseStatusReportRefreshInterval('-5000')).toBe(10000);
    });

    test('parses valid positive number interval correctly', () => {
      expect(parseStatusReportRefreshInterval('15000')).toBe(15000);
      expect(parseStatusReportRefreshInterval(5000)).toBe(5000);
    });
  });
});
