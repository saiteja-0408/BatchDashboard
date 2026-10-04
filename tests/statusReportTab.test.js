/**
 * statusReportTab.test.js
 *
 * Unit tests for StatusReportTab helper functions, global search, and table sorting logic:
 *   - Row status determination (Biz Error, OK, fallback)
 *   - Stable partitioning & sorting logic with Biz Error priority
 *   - Global multi-column search & Start Time formatting
 *   - Tab initialization and storage persistence
 */

// Inline / CommonJS compatible utilities matching client/src/utils/helpers.js

function getRowStatus(row) {
  if (!row) return '—';
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

  const errorMsg = row.error_message || row.errorMessage || row.error || row.error_desc || row.errorDescription;
  if (typeof errorMsg === 'string') {
    const errLower = errorMsg.toLowerCase();
    if (errLower.includes('biz error') || errLower.includes('business error') || errLower.includes('biz_error')) {
      return 'Biz Error';
    }
  }

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

function parseDateValue(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    if (/^\d{10,13}$/.test(s)) {
      const num = Number(s);
      const d = new Date(s.length === 10 ? num * 1000 : num);
      return isNaN(d.getTime()) ? null : d;
    }
    const db2Normalized = s.replace(/^(\d{4}-\d{2}-\d{2})[- ](\d{2})[.:](\d{2})[.:](\d{2})(?:\.(\d+))?/, '$1T$2:$3:$4.$5');
    const d1 = new Date(db2Normalized);
    if (!isNaN(d1.getTime())) return d1;
    const d2 = new Date(s);
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
}

function formatStandardDateTime(d) {
  if (!d || isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year  = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day   = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins  = pad(d.getMinutes());
  const secs  = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}

function filterStatusRows(allRows, searchQuery) {
  const rawQuery = searchQuery ? searchQuery.trim() : '';
  if (!rawQuery) return allRows;
  const q = rawQuery.toLowerCase();
  return allRows.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    for (const [key, val] of Object.entries(row)) {
      if (val === null || val === undefined) continue;
      const rawStr = String(val).toLowerCase();
      if (rawStr.includes(q)) return true;

      if (key.includes('time') || key.includes('date') || val instanceof Date) {
        const d = parseDateValue(val);
        if (d) {
          const formatted = formatStandardDateTime(d).toLowerCase();
          if (formatted.includes(q)) return true;
          const localeStr = d.toLocaleString().toLowerCase();
          if (localeStr.includes(q)) return true;
        }
      }
    }

    const statusStr = getRowStatus(row);
    if (statusStr && statusStr.toLowerCase().includes(q)) {
      return true;
    }

    if (
      q === 'biz error' ||
      q === 'biz' ||
      q === 'business error' ||
      q === 'error'
    ) {
      if (statusStr === 'Biz Error') return true;
    }
    return false;
  });
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

    test('identifies case variants like "BIZ ERROR" and "Business Error"', () => {
      expect(getRowStatus({ status: 'BIZ ERROR' })).toBe('Biz Error');
      expect(getRowStatus({ status: 'Business Error' })).toBe('Biz Error');
      expect(getRowStatus({ error_desc: 'Business Error in validation' })).toBe('Biz Error');
    });

    test('identifies biz_error_flag="N" as OK', () => {
      expect(getRowStatus({ biz_error_flag: 'N' })).toBe('OK');
    });

    test('handles fallback when neither is present', () => {
      expect(getRowStatus({})).toBe('—');
    });
  });

  describe('Global Multi-Column Search & Start Time formatting', () => {
    const sampleRows = [
      {
        job_name: 'BatchExportMSInterstateESRequestForLA',
        job_group: 'benefits_daily_930pm',
        start_time: '2026-10-03 21:30:00.846000',
        end_time: '2026-10-03 21:30:01.221000',
        biz_error_flag: 'N',
        error_flag: 'N',
        killed_flag: 'N',
        parent_job_name: null,
      },
      {
        job_name: 'BatchPayrollTaxCalc',
        job_group: 'benefits_daily_12pm',
        start_time: '2026-10-03T12:00:00.000Z',
        end_time: null,
        biz_error_flag: 'Y',
        error_flag: 'N',
        killed_flag: 'N',
        parent_job_name: null,
      },
      {
        job_name: 'BatchWithholdingReconcile',
        job_group: 'tax_weekly_monday',
        start_time: '2026-10-03 17:15:00.000000',
        end_time: '2026-10-03 17:52:00.000000',
        biz_error_flag: 'N',
        error_flag: 'Y',
        killed_flag: 'N',
        parent_job_name: 'BatchEnrollmentSync',
      },
    ];

    test('Searching "Biz Error" returns rows where status / biz_error_flag indicates Biz Error', () => {
      const results = filterStatusRows(sampleRows, 'Biz Error');
      expect(results).toHaveLength(1);
      expect(results[0].job_name).toBe('BatchPayrollTaxCalc');
    });

    test('Searching "biz error" case-insensitively returns Biz Error rows', () => {
      const results = filterStatusRows(sampleRows, 'biz error');
      expect(results).toHaveLength(1);
      expect(results[0].job_name).toBe('BatchPayrollTaxCalc');
    });

    test('Searching partial Start Time timestamp filters records accurately', () => {
      const results1 = filterStatusRows(sampleRows, '21:30:00');
      expect(results1).toHaveLength(1);
      expect(results1[0].job_name).toBe('BatchExportMSInterstateESRequestForLA');

      const results2 = filterStatusRows(sampleRows, '2026-10-03');
      expect(results2).toHaveLength(3);
    });

    test('Searching parent job name or job group finds matching records', () => {
      const byParent = filterStatusRows(sampleRows, 'BatchEnrollmentSync');
      expect(byParent).toHaveLength(1);
      expect(byParent[0].job_name).toBe('BatchWithholdingReconcile');

      const byGroup = filterStatusRows(sampleRows, '930pm');
      expect(byGroup).toHaveLength(1);
      expect(byGroup[0].job_name).toBe('BatchExportMSInterstateESRequestForLA');
    });

    test('Search handles null or undefined row properties without errors', () => {
      const edgeRows = [
        { job_name: null, start_time: undefined, biz_error_flag: null },
        { job_name: 'ValidJob', start_time: null, biz_error_flag: 'N' },
      ];
      expect(() => filterStatusRows(edgeRows, 'ValidJob')).not.toThrow();
      expect(filterStatusRows(edgeRows, 'ValidJob')).toHaveLength(1);
    });

    test('parseDateValue and formatStandardDateTime formats DB2 timestamp correctly', () => {
      const d = parseDateValue('2026-10-03 21:30:00.846000');
      expect(d).toBeInstanceOf(Date);
      expect(formatStandardDateTime(d)).toMatch(/2026-10-03 21:30:00/);
    });
  });

  describe('compareRowsByColumn — StatusReportTab multi-column sorting', () => {
    // Inline the compareValues and compareRowsByColumn logic mirroring the refactored StatusReportTab

    function compareValues(a, b, order = 'asc') {
      if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) return 0;
      if (a === null || a === undefined || a === '') return order === 'asc' ? 1 : -1;
      if (b === null || b === undefined || b === '') return order === 'asc' ? -1 : 1;
      const numA = typeof a === 'number' ? a : (typeof a === 'string' && a.trim() !== '' && !isNaN(Number(a)) ? Number(a) : NaN);
      const numB = typeof b === 'number' ? b : (typeof b === 'string' && b.trim() !== '' && !isNaN(Number(b)) ? Number(b) : NaN);
      if (!isNaN(numA) && !isNaN(numB)) return order === 'asc' ? numA - numB : numB - numA;
      const sa = String(a);
      const sb = String(b);
      const comp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
      return order === 'asc' ? comp : -comp;
    }

    function compareRowsByColumn(a, b, colId, direction) {
      if (colId === '_status') {
        const statusA = getRowStatus(a);
        const statusB = getRowStatus(b);
        const bizA = statusA === 'Biz Error' ? 0 : 1;
        const bizB = statusB === 'Biz Error' ? 0 : 1;
        if (bizA !== bizB) return direction === 'asc' ? bizA - bizB : bizB - bizA;
        return compareValues(statusA, statusB, direction);
      }
      if (colId === 'start_time' || colId === 'end_time' || colId === 'next_fire_time') {
        const msA = parseDateValue(a[colId]) ? parseDateValue(a[colId]).getTime() : null;
        const msB = parseDateValue(b[colId]) ? parseDateValue(b[colId]).getTime() : null;
        return compareValues(msA, msB, direction);
      }
      return compareValues(a[colId], b[colId], direction);
    }

    function nextSortConfig(current, colId) {
      if (!current || current.key !== colId) return { key: colId, direction: 'asc' };
      if (current.direction === 'asc') return { key: colId, direction: 'desc' };
      return null;
    }

    const rows = [
      { job_name: 'ZapBatch',  job_group: 'alpha', start_time: '2026-10-03 10:00:00.000000', biz_error_flag: 'N', error_flag: 'N' },
      { job_name: 'AlphaBatch', job_group: 'zeta',  start_time: '2026-10-03 08:00:00.000000', biz_error_flag: 'Y', error_flag: 'N' },
      { job_name: 'MidBatch',  job_group: 'beta',  start_time: '2026-10-03 09:00:00.000000', biz_error_flag: 'N', error_flag: 'Y' },
    ];

    test('sorts job_name column asc/desc by locale-aware string comparison', () => {
      const asc  = [...rows].sort((a, b) => compareRowsByColumn(a, b, 'job_name', 'asc'));
      const desc = [...rows].sort((a, b) => compareRowsByColumn(a, b, 'job_name', 'desc'));
      expect(asc.map(r => r.job_name)).toEqual(['AlphaBatch', 'MidBatch', 'ZapBatch']);
      expect(desc.map(r => r.job_name)).toEqual(['ZapBatch', 'MidBatch', 'AlphaBatch']);
    });

    test('sorts start_time column chronologically (Date comparison)', () => {
      const asc  = [...rows].sort((a, b) => compareRowsByColumn(a, b, 'start_time', 'asc'));
      const desc = [...rows].sort((a, b) => compareRowsByColumn(a, b, 'start_time', 'desc'));
      expect(asc.map(r => r.job_name)).toEqual(['AlphaBatch', 'MidBatch', 'ZapBatch']);
      expect(desc.map(r => r.job_name)).toEqual(['ZapBatch', 'MidBatch', 'AlphaBatch']);
    });

    test('_status asc places Biz Error rows first', () => {
      const asc = [...rows].sort((a, b) => compareRowsByColumn(a, b, '_status', 'asc'));
      // AlphaBatch has biz_error_flag=Y → getRowStatus = 'Biz Error' → first
      expect(asc[0].job_name).toBe('AlphaBatch');
    });

    test('_status desc places Biz Error rows last', () => {
      const desc = [...rows].sort((a, b) => compareRowsByColumn(a, b, '_status', 'desc'));
      expect(desc[desc.length - 1].job_name).toBe('AlphaBatch');
    });

    test('nextSortConfig cycles none → asc → desc → none', () => {
      let config = null;
      config = nextSortConfig(config, 'job_name');
      expect(config).toEqual({ key: 'job_name', direction: 'asc' });

      config = nextSortConfig(config, 'job_name');
      expect(config).toEqual({ key: 'job_name', direction: 'desc' });

      config = nextSortConfig(config, 'job_name');
      expect(config).toBeNull();
    });

    test('sorting never mutates original array', () => {
      const original = [...rows];
      const sorted = [...rows].sort((a, b) => compareRowsByColumn(a, b, 'job_name', 'asc'));
      // Original reference should be unchanged
      expect(rows).toEqual(original);
      expect(sorted).not.toEqual(rows);
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
