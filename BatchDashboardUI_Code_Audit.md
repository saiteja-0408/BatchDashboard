# BatchDashboardUI — Senior-Level Code Audit

**Audit date:** 2026-10-04  
**Scope:** Complete first-party repository content in the uploaded `BatchDashboardUI.zip`, plus archive/build/install hygiene.  
**Overall code health score:** **4.7 / 10**

## Executive assessment

The project has a reasonable small-app shape—React/TanStack Query/MUI on the client, Express services/controllers on the backend, centralized workbook parsing, and a meaningful server test suite—but it is **not production-ready in its current state**. The score is pulled down by one critical authorization gap, multiple high-impact correctness defects, a real command-injection risk in generated operator commands, known vulnerable spreadsheet parsing, unreliable schedule semantics, persistence/concurrency defects, and a test architecture that can pass while production logic is wrong.

The most important point is that these findings are not mostly style complaints. The audit found several failures that can change operational outcomes: failed/killed jobs can display as `OK`; status rows disappear during background polling; uploaded data can be acknowledged even when it was not persisted; the PostgreSQL/DB2 configuration contract is contradicted by hard-coded SQL; schedule “active” status is effectively unreachable; and upload tests can overwrite tracked workbook fixtures.

The codebase is recoverable without a rewrite. Fix the trust boundaries, persistence semantics, status/schedule correctness, and test architecture first. Do **not** spend time on React memoization or broad dependency upgrades until those defects are closed.

## Audit methodology and validation

I reviewed all **61 Git-tracked first-party files**, including source, configuration, tests, generators, documentation, lockfiles, and the three workbook fixtures. I also inspected ignored/generated content included in the uploaded archive (`node_modules`, `client/node_modules`, `client/dist`, `.git`, and `.env`) for delivery/reproducibility concerns.

The review included: static client/server reachability analysis from `client/src/main.jsx` and `server/app.js`; unused import/export/dependency reference scans; request/data-flow review; React state/query/render-path review; workbook parser and persistence review; schedule algorithm review; security trust-boundary review; test isolation/expectation review; package/config review; workbook structure inspection; and syntax checking of server/data/test JavaScript.

Validation results:
- Server/data/test JavaScript passed `node --check`.
- `npm test -- --runInBand` did **not** execute from the bundled install because the archived Jest runner installation was inconsistent/non-portable.
- `npm --prefix client run build` did **not** execute from the bundled install because the archived Vite/Rolldown native optional binding was missing.
- Those two failures are treated as **archive reproducibility findings**, not proof that a clean `npm ci` would fail.
- The delivered Git working tree reports `M data/benefits.xlsx`.
- `data/batches.xlsx` contains 22 Benefits + 22 Tax rows with the current four-column model; the standalone Benefits/Tax workbooks are inconsistent with that canonical fixture.
- Live `npm audit` could not be relied on in the sandbox, so exposed direct dependency advisories were independently verified from GitHub Advisory Database and official SheetJS/Vite documentation.

## Summary table

| Category | Critical | High | Medium | Low | Total |
|---|---:|---:|---:|---:|---:|
| Code Quality & Best Practices | 0 | 0 | 2 | 4 | 6 |
| Dead Code & Unused Assets | 0 | 0 | 4 | 2 | 6 |
| Logic & Correctness | 0 | 13 | 12 | 0 | 25 |
| Component & Architecture Design | 0 | 0 | 4 | 1 | 5 |
| Performance | 0 | 2 | 3 | 2 | 7 |
| Security | 1 | 4 | 2 | 1 | 8 |
| Error Handling | 0 | 0 | 6 | 1 | 7 |
| Maintainability & Documentation | 0 | 3 | 6 | 0 | 9 |
| Dependencies & Configuration | 0 | 4 | 2 | 3 | 9 |
| **Total** | **1** | **26** | **41** | **14** | **82** |

## Prioritized action plan

1. **P0 — Close the trust-boundary/security chain before deployment.** Add authentication/authorization to workbook upload (`SEC-01`), shell-escape/validate every generated command token (`SEC-02`), replace/upgrade vulnerable `xlsx` (`SEC-03`), lower/stream upload buffering (`SEC-04`), and stop exposing internal 5xx details (`SEC-06`).

2. **P0 — Make workbook updates durable and deterministic.** Change upload to `parse → validate → atomically persist → publish in-memory snapshot` (`LOG-12`), serialize store writes (`LOG-13`), enforce unique batch keys (`LOG-14`), strictly validate workbook headers (`LOG-15`, `LOG-25`), and isolate test data directories (`MAINT-03`).

3. **P0/P1 — Correct operational status semantics.** Fix system/killed status classification (`LOG-01`), prevent command generation when schedule data is missing (`LOG-02`), repair the status-table background-refresh blanking (`LOG-05`), and replace or redesign schedule heuristics before relying on “active/upcoming” information (`LOG-18`–`LOG-20`, `MAINT-06`).

4. **P1 — Make DB backend configuration real.** Remove hard-coded DB2 schema/dialect assumptions (`LOG-11`), validate backend names (`DEP-07`), declare `ibm_db` (`DEP-02`), coalesce refreshes (`PERF-02`), stop bypassing cache on every poll (`PERF-01`), and introduce connection reuse (`PERF-03`).

5. **P1 — Fix client state/race defects.** Cancel modal clear timers (`LOG-03`), validate stored tabs (`LOG-04`), clamp/reset virtual scroll (`LOG-06`, `LOG-07`), make virtualization row heights internally consistent (`LOG-08`), and preserve structured API errors (`ERR-05`).

6. **P1 — Repair the test strategy.** Import production logic instead of copying it (`MAINT-02`), remove conditional/multi-status assertions (`MAINT-04`), add React component tests (`MAINT-08`), and run clean-install lint/test/build gates in CI (`MAINT-05`, `DEP-06`).

7. **P2 — Remove dead/drifting features.** Either mount `AppHeader`/`SummaryCards` or delete their dependent code (`DEAD-01`, `DEAD-02`); decide whether Current Task is a feature or dead code (`DEAD-05`); remove unused hooks/utilities/dependencies (`DEAD-03`, `DEAD-06`, `DEP-05`).

8. **P2 — Normalize runtime and documentation.** Align Node engines with Vite 8 (`DEP-01`), fix Vite env loading/API-base configuration (`DEP-03`), consolidate workbook generators (`DEP-04`), validate configuration at startup (`DEP-08`), and rewrite README claims against actual behavior (`MAINT-01`).

9. **P3 — Refactor only after correctness is stable.** Split `StatusReportTab` and the parser pipeline around testable responsibilities (`QUAL-01`, `QUAL-02`), remove stale comments/redundancy (`QUAL-03`, `QUAL-04`), improve theme/accessibility polish, and optimize secondary render/sort paths (`PERF-05`–`PERF-07`).

# Detailed findings


## Code Quality & Best Practices


### QUAL-01 — StatusReportTab is a 583-line component combining parsing, search, sort, virtualization and presentation

- **File path:** `client/src/components/StatusReportTab/StatusReportTab.jsx`
- **Issue category:** Code Quality & Best Practices
- **Severity:** **Medium**

**Current code/problem**
```js
export function StatusReportTab({ enabled }) {
  // date parsing
  // search debounce/filter
  // sort state
  // virtual window math
  // error interpretation
  // table/chip rendering
}
```

**Improved code/recommended fix**
```js
// statusReport/date.js
export { parseStatusTimestamp, formatStatusTimestamp };

// statusReport/useStatusRows.js
export function useStatusRows(rows, searchQuery, sortConfig) { ... }

// statusReport/StatusTable.jsx
export function StatusTable({ rows, ...virtualization }) { ... }

// StatusReportTab.jsx
export function StatusReportTab(props) {
  const model = useStatusRows(...);
  return <StatusTable {...model} />;
}
```

**Why this improves the codebase**  
This component has multiple reasons to change and is difficult to test without copying internal functions. Extract pure date/status/search/sort utilities and a table/view layer. The goal is not arbitrary file splitting; it is to make business transformations directly importable by tests and keep rendering logic readable.


### QUAL-02 — fileParser duplicates schema extraction across ExcelJS, SheetJS and custom CSV paths

- **File path:** `server/utils/fileParser.js`
- **Issue category:** Code Quality & Best Practices
- **Severity:** **Medium**

**Current code/problem**
```js
_extractRowsFromWorkbook(...)
parseWithXLSXLibrary(...)
parseCsvBuffer(...)
// each maps headers/fields separately
```

**Improved code/recommended fix**
```js
function normalizeTable(headers, rows, sheetSource) {
  const mapping = buildStrictColumnMapping(headers);
  return rows
    .map((cells) => mapCells(cells, mapping, sheetSource))
    .filter((row) => row.batchName);
}

// Adapters only convert formats -> { headers, rows }
const table = await readWorkbookWithExcelJs(...);
return normalizeTable(table.headers, table.rows, sheetSource);
```

**Why this improves the codebase**  
Format adapters should only decode files. Header matching, required-column validation, row normalization, and warnings should live in one pipeline. Duplicating those rules is how XLSX and CSV support drift into different behavior.


### QUAL-03 — Comments/documentation inside source contradict actual behavior

- **File path:** `client/src/App.jsx; client/src/utils/helpers.js; server/app.js; server/utils/fileParser.js`
- **Issue category:** Code Quality & Best Practices
- **Severity:** **Low**

**Current code/problem**
```js
// App.jsx: Dashboard lazy-loaded so modal bundle is not downloaded until navigation.
// helpers.js: null values are "smaller" but implementation sorts them last ascending.
// app.js: edit files and restart, despite syncFromDisk hot reload.
// fileParser.js: "three mapped fields" although Trigger Needed is fourth.
```

**Improved code/recommended fix**
```js
// Comments should state invariants, not stale implementation history.
// Example:
const NULLS_LAST = true;
// compareValues intentionally places empty values last in ascending order.
```

**Why this improves the codebase**  
Stale comments are worse than no comments because they mislead maintenance decisions. Update comments as part of the same change that alters behavior, and remove narrative claims already obvious from the code.


### QUAL-04 — Search clearing is duplicated across context and SheetTabs

- **File path:** `client/src/context/BatchContext.jsx; client/src/components/SheetTabs/SheetTabs.jsx`
- **Issue category:** Code Quality & Best Practices
- **Severity:** **Low**

**Current code/problem**
```js
// BatchContext setActiveSheet clears search
...
// SheetTabs
setActiveSheet(newValue);
clearSearch();
```

**Improved code/recommended fix**
```js
const { activeSheet, setActiveSheet } = useBatchContext();

const handleChange = (_, newValue) => {
  setActiveSheet(newValue); // single owner clears search
};
```

**Why this improves the codebase**  
Two layers perform the same state transition, obscuring where the invariant lives. Keep “changing sheets clears search” in one place—preferably the context action if it is a domain invariant.


### QUAL-05 — Hardcoded light-theme status colors bypass the active MUI theme

- **File path:** `client/src/components/StatusReportTab/StatusReportTab.jsx`
- **Issue category:** Code Quality & Best Practices
- **Severity:** **Low**

**Current code/problem**
```js
backgroundColor: isBizError ? '#fff3e0 !important' : 'inherit',
'&:hover': {
  backgroundColor: isBizError ? '#ffe0b2 !important' : undefined,
}
```

**Improved code/recommended fix**
```js
backgroundColor: isBizError ? 'warning.50' : 'inherit',
'&:hover': {
  backgroundColor: isBizError ? 'action.hover' : undefined,
}
```

**Why this improves the codebase**  
The application has a dark-mode theme provider, but these literals are designed for light mode. Use palette tokens or `alpha(theme.palette.warning.main, ...)` so status rows remain readable in both modes.


### QUAL-06 — Custom Benefits SVG viewBox clips geometry that extends beyond its declared bounds

- **File path:** `client/src/components/SheetTabs/SheetTabs.jsx`
- **Issue category:** Code Quality & Best Practices
- **Severity:** **Low**

**Current code/problem**
```js
<SvgIcon {...props} viewBox="0 0 32 20">
...
d="... 14.5 21.4 ... 19.4 23.2 ..."
```

**Improved code/recommended fix**
```js
<SvgIcon {...props} viewBox="0 0 32 24">
  ...
</SvgIcon>
```

**Why this improves the codebase**  
The path reaches Y≈23.4 while the viewBox ends at 20, so part of the icon can be clipped/scaled incorrectly. Fix the viewBox to contain the path or replace the custom path with a tested icon asset.


## Dead Code & Unused Assets


### DEAD-01 — `AppHeader` is a complete orphaned component, so its theme toggle is unreachable

- **File path:** `client/src/components/AppHeader/AppHeader.jsx; client/src/App.jsx`
- **Issue category:** Dead Code & Unused Assets
- **Severity:** **Medium**

**Current code/problem**
```js
// App.jsx
<Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
  <Suspense ...>
    <Routes>...</Routes>
  </Suspense>
</Box>
```

**Improved code/recommended fix**
```js
import { AppHeader } from './components/AppHeader/AppHeader';

<Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
  <AppHeader />
  <Suspense ...>
    <Routes>...</Routes>
  </Suspense>
</Box>
```

**Why this improves the codebase**  
Static import-graph analysis from `client/src/main.jsx` found `AppHeader.jsx` unreachable. This exactly matches the failure class you called out: fully implemented code that is never mounted. Either render it in the application shell or delete it and the inaccessible theme-toggle behavior.


### DEAD-02 — `SummaryCards` is orphaned, leaving its summary query/client path unused

- **File path:** `client/src/components/SummaryCards/SummaryCards.jsx; client/src/hooks/useBatches.js; client/src/services/apiService.js`
- **Issue category:** Dead Code & Unused Assets
- **Severity:** **Medium**

**Current code/problem**
```js
export function SummaryCards() {
  const { data: summary, isLoading, isError } = useSummary();
  ...
}
```

**Improved code/recommended fix**
```js
// If desired:
import { SummaryCards } from '../components/SummaryCards/SummaryCards';

...
<SummaryCards />
<SheetTabs />
...

// Otherwise delete SummaryCards, useSummary and fetchSummary together.
```

**Why this improves the codebase**  
`SummaryCards.jsx` is unreachable from the client entry point. Consequently `useSummary()` and `fetchSummary()` have no first-party UI consumer. Make an explicit product decision: mount the cards and fix `summary.invalid`, or remove the dead client feature rather than carrying a false surface area.


### DEAD-04 — Runtime does not use the schedule catalog in `server/config/constants.js`

- **File path:** `server/config/constants.js; server/models/batchModel.js`
- **Issue category:** Dead Code & Unused Assets
- **Severity:** **Medium**

**Current code/problem**
```js
const VALID_SCHEDULE_NAMES = [ ... ];
...
module.exports = { VALID_SCHEDULE_NAMES, ... };
```

**Improved code/recommended fix**
```js
const { VALID_SCHEDULE_NAMES } = require('../config/constants');
const VALID_SCHEDULES = new Set(VALID_SCHEDULE_NAMES);

function validateBatch(batch) {
  const warnings = [];
  ...
  if (batch.scheduleName && !VALID_SCHEDULES.has(batch.scheduleName)) {
    warnings.push(`[${batch.batchName}] Unknown schedule "${batch.scheduleName}".`);
  }
  return warnings;
}
```

**Why this improves the codebase**  
The constants module is not reachable from `server/app.js`; it is only referenced by tests/scripts. README language claims schedule validation that runtime code does not perform. Either integrate the catalog into ingestion/summary logic or delete it and stop presenting it as an authoritative runtime contract.


### DEAD-05 — Current Task feature is compiled end-to-end but hard-disabled

- **File path:** `client/src/components/BatchTable/BatchTable.jsx; client/src/hooks/useBatches.js; server/controllers/currentTasksController.js`
- **Issue category:** Dead Code & Unused Assets
- **Severity:** **Medium**

**Current code/problem**
```js
const SHOW_CURRENT_TASK = false;
...
useCurrentTasks(SHOW_CURRENT_TASK ? activeSheet : null, SHOW_CURRENT_TASK);
```

**Improved code/recommended fix**
```js
export const SHOW_CURRENT_TASK =
  import.meta.env.VITE_SHOW_CURRENT_TASK === 'true';

// Or remove CurrentTaskBadge/useCurrentTasks/API route if the feature is abandoned.
```

**Why this improves the codebase**  
A hardcoded false flag makes the component, polling hook, and backend endpoint dormant from the actual UX while still requiring maintenance and tests. Use a documented feature flag only if staged rollout is intentional; otherwise delete the feature until it is needed (YAGNI).


### DEAD-03 — Several client APIs/utilities have no production callers

- **File path:** `client/src/hooks/useBatches.js; client/src/services/apiService.js; client/src/utils/constants.js; client/src/utils/helpers.js`
- **Issue category:** Dead Code & Unused Assets
- **Severity:** **Low**

**Current code/problem**
```js
export function useBatchByName(...) { ... }
export const searchBatches = (...) => ...
export function buildCommand(...) { ... }
export const COLUMN_LABELS = { ... }
export function formatDate(...) { ... }
```

**Improved code/recommended fix**
```js
// Delete unreferenced exports until a real consumer exists.
// Keep only APIs imported by production source, e.g.
export { buildQclientLine, LOG_PATH_DEFS, SORTABLE_COLUMNS };
```

**Why this improves the codebase**  
Reference scanning found no production consumers for `useBatchByName`, `fetchBatchByName`, client `searchBatches`, `buildCommand`, `COLUMN_LABELS`, or `formatDate`. Dead abstractions increase maintenance and make reviewers assume behavior is exercised when it is not. The server endpoints can remain if they are a supported external API; the unused client wrappers do not need to.


### DEAD-06 — Unused imports and direct client dependencies add noise and install/bundle surface

- **File path:** `client/src/**; server/routes/batchRoutes.js; client/package.json`
- **Issue category:** Dead Code & Unused Assets
- **Severity:** **Low**

**Current code/problem**
```js
import React from 'react'; // multiple JSX files under automatic transform
const os = require('os');
const path = require('path');

"@mui/x-date-pickers": "...",
"date-fns": "...",
"react-window": "..."
```

**Improved code/recommended fix**
```js
// Remove unused default React imports where React is not referenced.
// Remove os/path imports from batchRoutes.js.
// package.json: remove direct deps with zero source imports:
npm --prefix client uninstall @mui/x-date-pickers date-fns react-window
```

**Why this improves the codebase**  
Static reference scans found no first-party imports of `@mui/x-date-pickers`, `date-fns`, or `react-window`, and several source imports are unused. This is low risk but easy hygiene: less dependency churn, fewer audit findings, and cleaner review diffs.


## Logic & Correctness


### LOG-01 — Status classification ignores system error and killed flags

- **File path:** `client/src/utils/helpers.js`
- **Issue category:** Logic & Correctness
- **Severity:** **High**

**Current code/problem**
```js
if (row.biz_error_flag === 'N' || row.biz_error_flag === 'n' ||
    row.biz_error === 'N' || row.biz_error === 'n') {
  return 'OK';
}
...
return 'OK';
```

**Improved code/recommended fix**
```js
const truthyFlag = (v) => ['y', 'yes', 'true', '1'].includes(String(v ?? '').trim().toLowerCase());

export function getRowStatus(row) {
  if (!row) return 'Unknown';
  if (truthyFlag(row.killed_flag ?? row.killed)) return 'Killed';
  if (truthyFlag(row.error_flag ?? row.error)) return 'Error';
  if (truthyFlag(row.biz_error_flag ?? row.biz_error)) return 'Biz Error';

  const explicit = String(row.status ?? row.job_status ?? '').trim();
  return explicit || 'OK';
}
```

**Why this improves the codebase**  
The current branch can return `OK` as soon as `biz_error_flag` is `N`, even when `error_flag` or `killed_flag` is set. The supplied mock data contains these flag types, so the UI can falsely show failed/killed jobs as healthy. Define and test an explicit precedence order.


### LOG-02 — CommandViewer warns about a missing schedule but still renders runnable-looking commands

- **File path:** `client/src/components/CommandViewer/CommandViewer.jsx`
- **Issue category:** Logic & Correctness
- **Severity:** **High**

**Current code/problem**
```js
{!batch.scheduleName && (
  <Alert severity="warning">
    Schedule name is missing; commands cannot be constructed reliably.
  </Alert>
)}
...
const runCommand = buildQclientLine(batch, 'runJobOnly');
const resumeCommand = buildQclientLine(batch, 'resumeJob');
```

**Improved code/recommended fix**
```js
const canBuildCommands = Boolean(batch.batchName?.trim() && batch.scheduleName?.trim());

if (!canBuildCommands) {
  return (
    <Alert severity="warning">
      This batch is missing a batch name or schedule name. Run/resume commands are disabled.
    </Alert>
  );
}

const runCommand = buildQclientLine(batch, 'runJobOnly');
const resumeCommand = buildQclientLine(batch, 'resumeJob');
```

**Why this improves the codebase**  
The UI contradicts itself: it says commands cannot be constructed reliably, then constructs them with an empty token. That creates misleading operational instructions. Treat required command fields as a hard precondition and disable generation/copying until valid.


### LOG-03 — Modal close timer can clear a newly opened batch

- **File path:** `client/src/context/BatchContext.jsx`
- **Issue category:** Logic & Correctness
- **Severity:** **High**

**Current code/problem**
```js
const closeBatchModal = useCallback(() => {
  dispatchModal({ type: 'CLOSE' });
  setTimeout(() => dispatchModal({ type: 'CLEAR' }), 300);
}, []);
```

**Improved code/recommended fix**
```js
const clearTimerRef = useRef(null);

const openBatchModal = useCallback((batch) => {
  clearTimeout(clearTimerRef.current);
  dispatchModal({ type: 'OPEN', batch });
}, []);

const closeBatchModal = useCallback(() => {
  dispatchModal({ type: 'CLOSE' });
  clearTimerRef.current = setTimeout(
    () => dispatchModal({ type: 'CLEAR' }),
    300
  );
}, []);

useEffect(() => () => clearTimeout(clearTimerRef.current), []);
```

**Why this improves the codebase**  
If the user closes one modal and opens another within 300 ms, the stale timer dispatches `CLEAR` against the new selection. Cancel the pending timer on open/unmount, or better clear the selected batch from the Dialog's `onExited` transition callback so state follows the actual transition.


### LOG-05 — Status table disappears during every background refetch

- **File path:** `client/src/components/StatusReportTab/StatusReportTab.jsx`
- **Issue category:** Logic & Correctness
- **Severity:** **High**

**Current code/problem**
```js
{isFetching && allRows.length === 0 && <SkeletonRows rows={5} />}
...
{!isFetching && visibleRows.map((row, idx) => ( ... ))}
...
{!isFetching && paddingBottom > 0 && ( ... )}
```

**Improved code/recommended fix**
```js
{isFetching && allRows.length === 0 && <SkeletonRows rows={5} />}

{allRows.length > 0 && (
  <>
    {paddingTop > 0 && <Spacer height={paddingTop} />}
    {visibleRows.map((row) => <StatusRow key={statusRowKey(row)} row={row} />)}
    {paddingBottom > 0 && <Spacer height={paddingBottom} />}
  </>
)}
```

**Why this improves the codebase**  
React Query marks background polling as `isFetching=true` even when cached rows exist. The current render guards hide all existing rows while fetching, causing the body to blank/flicker on each poll. Keep stale data visible and show refresh progress separately.


### LOG-11 — Status-report SQL hardcodes the DB2 schema and is not portable to the advertised PostgreSQL backend

- **File path:** `server/controllers/statusReportController.js; server/config/db2.config.js; server/config/pg.config.js`
- **Issue category:** Logic & Correctness
- **Severity:** **High**

**Current code/problem**
```js
const STATUS_REPORT_SQL = `
  SELECT *
  FROM db2prd1.T_Z_QRTZ_STATUS_REPORT
  ...
`;
```

**Improved code/recommended fix**
```js
function assertIdentifier(value, name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function buildStatusReportSql(backend) {
  const schema = assertIdentifier(
    backend === 'pg' ? (process.env.PG_SCHEMA || 'public') : (process.env.DB2_SCHEMA || 'db2prd1'),
    'status report schema'
  );
  return `
    SELECT job_name, job_group, start_time, end_time, next_fire_time,
           biz_error_flag, error_flag, killed_flag, parent_job_name, parent_job_group
    FROM ${schema}.T_Z_QRTZ_STATUS_REPORT
    WHERE DATE(start_time) = CURRENT_DATE
  `;
}
```

**Why this improves the codebase**  
`DB2_SCHEMA` is configurable but ignored by this query. More importantly, the same SQL is sent through both DB2 and PostgreSQL adapters, despite schema/function/dialect differences. Build backend-specific, explicit-column queries and validate identifiers before interpolation.


### LOG-12 — Upload reports success even when the workbook was not persisted

- **File path:** `server/services/excelService.js`
- **Issue category:** Logic & Correctness
- **Severity:** **High**

**Current code/problem**
```js
_store = [
  ..._store.filter((b) => b.sheetSource !== sheetSource),
  ...incoming,
];

try {
  fs.writeFileSync(targetFile, buffer);
} catch (fsErr) {
  console.warn(`... Could not persist ...`);
}
return { count: incoming.length, warnings };
```

**Improved code/recommended fix**
```js
const targetFile = getTargetFilePath(sheetSource);
const tempFile = `${targetFile}.${process.pid}.${Date.now()}.tmp`;

await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });
await fs.promises.writeFile(tempFile, buffer);
await fs.promises.rename(tempFile, targetFile);

_store = [
  ..._store.filter((b) => b.sheetSource !== sheetSource),
  ...incoming,
];
_fileMtimes[sheetSource] = (await fs.promises.stat(targetFile)).mtimeMs;

return { count: incoming.length, warnings };
```

**Why this improves the codebase**  
The in-memory store is updated first and disk-write exceptions are swallowed. A user sees a successful upload, but the data disappears on restart. Persist atomically first, then publish the new in-memory snapshot. If persistence fails, return a 5xx and keep the previous store.


### LOG-13 — Global mutable workbook store has no serialization between uploads and hot reloads

- **File path:** `server/services/excelService.js`
- **Issue category:** Logic & Correctness
- **Severity:** **High**

**Current code/problem**
```js
let _store = [];
...
const { batches } = await _parseToBatches(filePath, src);
_store = [
  ..._store.filter((b) => b.sheetSource !== src),
  ...batches,
];
```

**Improved code/recommended fix**
```js
let writeQueue = Promise.resolve();

function serializeStoreWrite(work) {
  const next = writeQueue.then(work, work);
  writeQueue = next.catch(() => {});
  return next;
}

async function reloadSheet(sheetSource, buffer) {
  return serializeStoreWrite(async () => {
    // parse -> persist -> publish one immutable snapshot
  });
}
```

**Why this improves the codebase**  
Two async reload paths can parse from different source versions and then overwrite each other's updates. The code is single-threaded but still concurrent across `await` boundaries. Serialize writes per sheet (or globally), and publish an immutable versioned snapshot only after persistence succeeds.


### LOG-14 — The documented unique key `batchName` is not actually enforced

- **File path:** `server/models/batchModel.js; server/services/excelService.js`
- **Issue category:** Logic & Correctness
- **Severity:** **High**

**Current code/problem**
```js
@property {string} batchName - Batch / job name (primary key — must be unique per sheet)
...
if (batch.batchName) batches.push(batch);
```

**Improved code/recommended fix**
```js
function assertUniqueBatchNames(batches, sheetSource) {
  const seen = new Set();
  for (const batch of batches) {
    const key = batch.batchName.trim().toLowerCase();
    if (seen.has(key)) {
      const err = new Error(`Duplicate batchName "${batch.batchName}" in ${sheetSource}`);
      err.status = 422;
      throw err;
    }
    seen.add(key);
  }
}
```

**Why this improves the codebase**  
Duplicate names make `getByName()` ambiguous, collide in React keys, and overwrite entries in the current-task lookup map. If the model calls a field a primary key, enforce it at the ingestion boundary and reject duplicate uploads.


### LOG-15 — Unknown spreadsheet headers silently fall back to positional mapping

- **File path:** `server/utils/fileParser.js`
- **Issue category:** Logic & Correctness
- **Severity:** **High**

**Current code/problem**
```js
if (!Object.values(colIndexToField).includes('batchName') && headerCells.length > 0) {
  colIndexToField[0] = 'batchName';
  if (headerCells.length > 1) colIndexToField[1] = headerCells.length === 2 ? 'scheduleName' : 'arguments';
  if (headerCells.length > 2) colIndexToField[2] = 'scheduleName';
  if (headerCells.length > 3) colIndexToField[3] = 'triggerNeeded';
}
```

**Improved code/recommended fix**
```js
const mappedFields = new Set(Object.values(colIndexToField));
const missing = ['batchName', 'scheduleName'].filter((f) => !mappedFields.has(f));

if (missing.length) {
  const err = new Error(
    `Unrecognized workbook schema. Missing required columns: ${missing.join(', ')}. ` +
    `Headers received: ${headerCells.join(', ')}`
  );
  err.status = 422;
  throw err;
}
```

**Why this improves the codebase**  
Position-based guessing can accept the wrong workbook and reinterpret unrelated columns as operational batch data. That is a data-integrity failure. Require recognized mandatory headers and fail fast with a useful 422 response.


### LOG-16 — Home-grown CSV parser mishandles standard CSV quoting rules

- **File path:** `server/utils/fileParser.js`
- **Issue category:** Logic & Correctness
- **Severity:** **High**

**Current code/problem**
```js
if (char === '"' || char === "'") {
  inQuotes = !inQuotes;
} else if (char === ',' && !inQuotes) {
  ...
}
```

**Improved code/recommended fix**
```js
const XLSX = require('xlsx');

function parseCsvBuffer(buffer, sheetSource) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
  return extractFromSheetJsWorkbook(workbook, sheetSource);
}
```

**Why this improves the codebase**  
CSV uses double quotes, escaped quotes (`""`), and may contain commas/newlines inside quoted fields; apostrophes are ordinary data. The current parser toggles quote state on either `'` or `"`, does not handle escaped quotes, and operates line-by-line, so legitimate CSV can be corrupted. Use a standards-compliant CSV parser rather than maintaining one here.


### LOG-18 — Recurring schedule status makes the advertised active window effectively unreachable

- **File path:** `server/utils/scheduleParser.js`
- **Issue category:** Logic & Correctness
- **Severity:** **High**

**Current code/problem**
```js
function nextDaily(hm, now) {
  let d = new Date(...);
  if (d <= now) d = addDays(d, 1);
  return d;
}
...
status: computeStatus(nextRun, now)
```

**Improved code/recommended fix**
```js
function occurrenceWindow(previousRun, nextRun, now) {
  const delta = now.getTime() - previousRun.getTime();
  if (Math.abs(delta) <= ACTIVE_WINDOW_MS) return 'active';
  if (nextRun.getTime() - now.getTime() <= UPCOMING_WINDOW_MS) return 'upcoming';
  return 'idle';
}

// For every cadence, calculate both previousRun and nextRun from an anchored rule.
```

**Why this improves the codebase**  
Most cadence helpers advance an occurrence to the future before status is computed. At the exact scheduled time the `<=` comparison advances to the next occurrence, so the ±15-minute active window cannot describe the occurrence that just fired. Compute previous/current and next occurrences from a stable cadence, then classify against the current occurrence.


### LOG-19 — Several schedule names are deliberately approximated rather than correctly evaluated

- **File path:** `server/utils/scheduleParser.js`
- **Issue category:** Logic & Correctness
- **Severity:** **High**

**Current code/problem**
```js
if (lower.includes('biweekly')) {
  const d = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
  ...
}
// Handle "1st_work_day" patterns: approximate as Monday
```

**Improved code/recommended fix**
```js
// Prefer authoritative next-fire timestamps from the scheduler.
// If local parsing is mandatory, define structured rules:
{
  frequency: 'biweekly',
  anchorDate: '2026-01-05',
  weekday: 1,
  time: '06:00',
  calendar: 'BUSINESS_US'
}
```

**Why this improves the codebase**  
Biweekly cannot be calculated as “now + 14 days” because cadence needs an anchor. “Work day” and holiday schedules require a business calendar, not weekday guesses. Annual/quarterly special names are also heuristically interpreted. For an operations dashboard, wrong next-run information is worse than showing “unknown”; source scheduler metadata or explicit schedule definitions instead of guessing.


### LOG-20 — Schedule calculations implicitly use the server process timezone

- **File path:** `server/utils/scheduleParser.js`
- **Issue category:** Logic & Correctness
- **Severity:** **High**

**Current code/problem**
```js
function parseSchedule(scheduleName, now = new Date()) {
  ...
  new Date(now.getFullYear(), month, day, hour, minute, 0, 0)
}
```

**Improved code/recommended fix**
```js
const { DateTime } = require('luxon');
const ZONE = process.env.SCHEDULER_TIME_ZONE || 'America/Chicago';

function nowInSchedulerZone() {
  return DateTime.now().setZone(ZONE);
}
// Perform rule calculations in ZONE and emit ISO timestamps with offsets.
```

**Why this improves the codebase**  
The same process can run in local developer time, UTC in a container, or another server timezone and produce different “next task” answers. Add an explicit scheduler timezone and use timezone-aware calculations, or use scheduler-provided next-fire timestamps.


### LOG-04 — Stored active tab is trusted without validating it against supported sheet values

- **File path:** `client/src/context/BatchContext.jsx`
- **Issue category:** Logic & Correctness
- **Severity:** **Medium**

**Current code/problem**
```js
const saved = sessionStorage.getItem(STORAGE_TAB_KEY) || localStorage.getItem(STORAGE_TAB_KEY);
return saved || 'benefits';
```

**Improved code/recommended fix**
```js
import { SHEET_SOURCES } from '../utils/constants';

const DEFAULT_SHEET = 'benefits';
const saved = sessionStorage.getItem(STORAGE_TAB_KEY) || localStorage.getItem(STORAGE_TAB_KEY);
return SHEET_SOURCES.includes(saved) ? saved : DEFAULT_SHEET;
```

**Why this improves the codebase**  
A stale or manually edited storage value can make MUI Tabs receive an unknown value, disable the batch query, or route upload logic to the wrong path. Validate both initialization and `setActiveSheet` input.


### LOG-06 — Status virtualization can render zero rows after filter/sort shrinks the dataset

- **File path:** `client/src/components/StatusReportTab/StatusReportTab.jsx`
- **Issue category:** Logic & Correctness
- **Severity:** **Medium**

**Current code/problem**
```js
const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_COUNT);
const endIndex = Math.min(totalCount, ...);
const visibleRows = sortedRows.slice(startIndex, endIndex);
```

**Improved code/recommended fix**
```js
useEffect(() => {
  setScrollTop(0);
  containerRef.current?.scrollTo({ top: 0 });
}, [searchQuery, sortConfig?.key, sortConfig?.direction]);

const maxStart = Math.max(0, totalCount - 1);
const startIndex = Math.min(
  maxStart,
  Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_COUNT)
);
```

**Why this improves the codebase**  
If the user is far down the table and a search reduces the result set, `startIndex` can remain beyond `totalCount`, producing an empty slice despite matching rows. Reset or clamp virtual scroll whenever the dataset/sort changes.


### LOG-07 — Batch table has the same stale-scroll virtualization failure

- **File path:** `client/src/components/BatchTable/BatchTable.jsx`
- **Issue category:** Logic & Correctness
- **Severity:** **Medium**

**Current code/problem**
```js
const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - OVERSCAN_COUNT);
...
const visibleBatches = useMemo(
  () => sortedData.slice(startIndex, endIndex),
  [sortedData, startIndex, endIndex]
);
```

**Improved code/recommended fix**
```js
useEffect(() => {
  setScrollTop(0);
  containerRef.current?.scrollTo({ top: 0 });
}, [activeSheet, sortedData.length, sortConfig?.key, sortConfig?.direction]);

const maxStart = Math.max(0, sortedData.length - 1);
const startIndex = Math.min(
  maxStart,
  Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - OVERSCAN_COUNT)
);
```

**Why this improves the codebase**  
Switching sheets, changing search results, or sorting while scrolled can leave `scrollTop` outside the new dataset. Reset/clamp the viewport to prevent apparently empty tables.


### LOG-08 — Status virtualization assumes fixed-height rows while cells are allowed to wrap

- **File path:** `client/src/components/StatusReportTab/StatusReportTab.jsx`
- **Issue category:** Logic & Correctness
- **Severity:** **Medium**

**Current code/problem**
```js
whiteSpace: col.id === 'job_name' || col.id === 'parent_job_name'
  ? 'normal'
  : 'nowrap',
wordBreak: col.id === 'job_name' || col.id === 'parent_job_name'
  ? 'break-word'
  : 'normal',
```

**Improved code/recommended fix**
```js
sx={{
  height: `${ROW_HEIGHT}px`,
  '& td': {
    height: `${ROW_HEIGHT}px`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}}
```

**Why this improves the codebase**  
Spacer math is based on a fixed row height, but wrapped job names can make physical rows taller. Once that happens, virtual offsets drift and rows can overlap/jump. Either enforce fixed-height single-line cells or use a virtualizer that measures dynamic row heights.


### LOG-09 — Numeric Unix timestamps in seconds are treated as milliseconds

- **File path:** `client/src/components/StatusReportTab/StatusReportTab.jsx`
- **Issue category:** Logic & Correctness
- **Severity:** **Medium**

**Current code/problem**
```js
if (typeof v === 'number') {
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
```

**Improved code/recommended fix**
```js
if (typeof v === 'number') {
  const millis = Math.abs(v) < 1e12 ? v * 1000 : v;
  const d = new Date(millis);
  return Number.isNaN(d.getTime()) ? null : d;
}
```

**Why this improves the codebase**  
A 10-digit epoch such as `1719853200` becomes a date in January 1970 when passed directly to `new Date(number)`, while the string path already distinguishes 10- vs 13-digit epochs. Make numeric and string behavior consistent.


### LOG-10 — DB timestamp parsing depends on implementation-defined Date string parsing

- **File path:** `client/src/components/StatusReportTab/StatusReportTab.jsx`
- **Issue category:** Logic & Correctness
- **Severity:** **Medium**

**Current code/problem**
```js
const normalized = s.replace(
  /^(\d{4})-(\d{2})-(\d{2})[- ](\d{2})\.(\d{2})\.(\d{2})(\.\d+)?$/,
  '$1-$2-$3T$4:$5:$6$7'
);
const d2 = new Date(normalized);
```

**Improved code/recommended fix**
```js
const m = s.match(
  /^(\d{4})-(\d{2})-(\d{2})[- ](\d{2})[.:](\d{2})[.:](\d{2})(?:\.(\d{1,6}))?$/
);
if (m) {
  const [, y, mo, d, h, mi, sec, frac = ''] = m;
  const ms = Number((frac + '000').slice(0, 3));
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec), ms);
}
```

**Why this improves the codebase**  
DB2-style timestamps commonly carry microseconds. JavaScript's permissive Date parser is not a stable DB timestamp parser across formats/runtimes. Parse components explicitly and decide whether the database timestamps are local time or UTC.


### LOG-17 — Route parameter is decoded twice

- **File path:** `server/controllers/batchController.js`
- **Issue category:** Logic & Correctness
- **Severity:** **Medium**

**Current code/problem**
```js
const name = decodeURIComponent(req.params.name);
```

**Improved code/recommended fix**
```js
const name = req.params.name;
```

**Why this improves the codebase**  
Express has already decoded path parameters. Double-decoding can transform a literal percent-encoded sequence a second time or throw `URIError` on valid names containing `%`. Use `req.params.name` directly.


### LOG-21 — Mock status rows are frozen to the date/time when the module was loaded

- **File path:** `server/services/mockData.js`
- **Issue category:** Logic & Correctness
- **Severity:** **Medium**

**Current code/problem**
```js
const today = new Date();
const yyyy = today.getFullYear();
...
const MOCK_STATUS_ROWS = [ ... ];
```

**Improved code/recommended fix**
```js
function buildMockStatusRows(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return [/* construct rows from yyyy/mm/dd */];
}
```

**Why this improves the codebase**  
A mock-mode server that stays up across midnight continues returning yesterday-anchored rows until restart. Generate time-sensitive fixture data at request time or from an injected clock.


### LOG-22 — Summary API always reports zero invalid schedules

- **File path:** `server/services/excelService.js; client/src/components/SummaryCards/SummaryCards.jsx`
- **Issue category:** Logic & Correctness
- **Severity:** **Medium**

**Current code/problem**
```js
return { total, benefits, tax, invalid: 0, bySheet };
...
<StatCard label="Unknown Schedules" value={summary.invalid} />
```

**Improved code/recommended fix**
```js
const validSchedules = new Set(VALID_SCHEDULE_NAMES);
const invalid = _store.filter(
  (b) => b.scheduleName && !validSchedules.has(b.scheduleName)
).length;

return { total, benefits, tax, invalid, bySheet };
```

**Why this improves the codebase**  
The API exposes an `invalid` metric and the UI labels it “Unknown Schedules,” but it is hardcoded to zero. Either implement the metric using the real schedule catalog or remove it. A hardcoded health metric creates false confidence.


### LOG-23 — Virtualized status rows use array indexes as keys

- **File path:** `client/src/components/StatusReportTab/StatusReportTab.jsx`
- **Issue category:** Logic & Correctness
- **Severity:** **Medium**

**Current code/problem**
```js
const absoluteIdx = startIndex + idx;
<TableRow key={absoluteIdx}>
```

**Improved code/recommended fix**
```js
function statusRowKey(row) {
  return [
    row.job_name,
    row.job_group,
    row.start_time,
    row.parent_job_name,
  ].map((v) => String(v ?? '')).join('|');
}

<TableRow key={statusRowKey(row)}>
```

**Why this improves the codebase**  
Index keys are tied to position, not identity. Filtering, sorting, or polling can reuse the same key for a different job, causing React to retain stale row-local state or DOM. Use a database row ID if available; otherwise construct and validate a stable composite key.


### LOG-24 — `syncFromDisk` only reloads when mtime increases and swallows reload failures

- **File path:** `server/services/excelService.js`
- **Issue category:** Logic & Correctness
- **Severity:** **Medium**

**Current code/problem**
```js
const mtime = fs.statSync(filePath).mtimeMs;
if (mtime > (_fileMtimes[src] || 0)) {
  ...
}
...
catch (e) {
  console.warn(`[excelService] Failed to hot-reload ${src}: ${e.message}`);
}
```

**Improved code/recommended fix**
```js
const stat = await fs.promises.stat(filePath);
if (stat.mtimeMs !== (_fileMtimes[src] ?? 0)) {
  const snapshot = await parseAndValidate(filePath, src);
  publish(snapshot);
  _fileMtimes[src] = stat.mtimeMs;
}
```

**Why this improves the codebase**  
Replacing a file with a preserved/older timestamp will not reload, and parse errors are silently converted into stale data. Compare a version/hash or at least inequality, retain the last-known-good snapshot intentionally, and expose reload failure through readiness/metrics rather than only a warning.


### LOG-25 — Fuzzy header matching is broad enough to map unrelated `Job ...` columns as the batch name

- **File path:** `server/utils/fileParser.js`
- **Issue category:** Logic & Correctness
- **Severity:** **Medium**

**Current code/problem**
```js
// matchHeaderField accepts broad normalized patterns such as startsWith('job')
```

**Improved code/recommended fix**
```js
const HEADER_ALIASES = new Map([
  ['batch name/job name', 'batchName'],
  ['batch name', 'batchName'],
  ['job name', 'batchName'],
  ['batch arguments/jvm arguments', 'arguments'],
  ['schedule name/ job group name', 'scheduleName'],
  ['trigger needed', 'triggerNeeded'],
]);

const field = HEADER_ALIASES.get(normalizeHeader(header));
```

**Why this improves the codebase**  
Loose prefix matching makes accidental schema acceptance more likely (for example, `Job Status` can resemble a job-name field). Use an explicit alias set and report unknown headers. Production ingestion should favor false negatives over silently wrong mappings.


## Component & Architecture Design


### ARCH-01 — StatusReportTab and Dashboard mount two observers for the same polling query

- **File path:** `client/src/pages/Dashboard.jsx; client/src/components/StatusReportTab/StatusReportTab.jsx`
- **Issue category:** Component & Architecture Design
- **Severity:** **Medium**

**Current code/problem**
```js
// Dashboard
const { isFetching: srFetching, refresh: srRefresh, data: srEnvelope } =
  useStatusReport(isStatusReportTab);

// StatusReportTab also calls useStatusReport(enabled)
```

**Improved code/recommended fix**
```js
// Dashboard owns the query once
const statusReport = useStatusReport(isStatusReportTab);

<StatusReportTab
  envelope={statusReport.data}
  isFetching={statusReport.isFetching}
  isError={statusReport.isError}
  error={statusReport.error}
/>
```

**Why this improves the codebase**  
TanStack Query deduplicates the underlying query, so this is not necessarily two HTTP calls, but it is still two query observers, two layers of polling semantics, and duplicated ownership. Fetch once at the nearest common owner and pass the data/control surface down, or move the toolbar into StatusReportTab so the feature owns its own query.


### ARCH-02 — Server starts listening as a module side effect, forcing tests to reconstruct a different app

- **File path:** `server/app.js; tests/*.integration.test.js`
- **Issue category:** Component & Architecture Design
- **Severity:** **Medium**

**Current code/problem**
```js
const app = express();
...
async function bootstrap() { ... app.listen(PORT, '127.0.0.1', ...); }
bootstrap();
```

**Improved code/recommended fix**
```js
function createApp() {
  const app = express();
  // middleware/routes/error handler
  return app;
}

async function start() {
  await loadData();
  const app = createApp();
  return app.listen(PORT, HOST);
}

if (require.main === module) start();
module.exports = { createApp, start };
```

**Why this improves the codebase**  
Integration tests currently create minimal Express apps instead of testing the production middleware stack because importing `app.js` starts a server. Split app construction from process startup. This also enables graceful shutdown and removes route-stack drift between production and tests.


### ARCH-03 — Sheet/query validation is duplicated or absent across controllers

- **File path:** `server/controllers/batchController.js; server/controllers/currentTasksController.js; server/controllers/uploadController.js`
- **Issue category:** Component & Architecture Design
- **Severity:** **Medium**

**Current code/problem**
```js
const sheet = req.query.sheet || undefined;
// other controller defaults/validates differently
```

**Improved code/recommended fix**
```js
const VALID_SHEETS = new Set(['benefits', 'tax']);

function parseSheet(value, { optional = true } = {}) {
  if ((value === undefined || value === '') && optional) return undefined;
  if (!VALID_SHEETS.has(value)) {
    throw Object.assign(new Error('sheet must be benefits or tax'), { status: 400 });
  }
  return value;
}
```

**Why this improves the codebase**  
Invalid sheets currently produce inconsistent behavior: empty datasets, a default to Tax in some paths, or explicit upload rejection. Centralize request parsing so the same input has the same semantics and status code across endpoints.


### ARCH-05 — Business data and persistence are represented as process-global state instead of an injectable repository

- **File path:** `server/services/excelService.js`
- **Issue category:** Component & Architecture Design
- **Severity:** **Medium**

**Current code/problem**
```js
let _store = [];
let _benefitsPath = null;
let _taxPath = null;
let _fileMtimes = { benefits: 0, tax: 0 };
```

**Improved code/recommended fix**
```js
class BatchRepository {
  constructor({ dataDir, parser, fsApi = fs.promises }) {
    this.dataDir = dataDir;
    this.parser = parser;
    this.fs = fsApi;
    this.snapshot = Object.freeze([]);
  }

  async reloadSheet(sheet, buffer) { ... }
  getAll(sheet) { ... }
}
```

**Why this improves the codebase**  
Module globals make concurrency, test isolation, and lifecycle management harder. An injectable repository lets tests use a temp filesystem/in-memory parser and makes write serialization/versioning an explicit responsibility rather than hidden shared state.


### ARCH-04 — Batch data endpoint fetches all sheets even when the active view needs one

- **File path:** `client/src/hooks/useBatches.js`
- **Issue category:** Component & Architecture Design
- **Severity:** **Low**

**Current code/problem**
```js
queryKey: ['batches', 'all'],
queryFn: () => fetchAllBatches(),
select: (allData) => allData.filter((b) => b.sheetSource === sheet),
```

**Improved code/recommended fix**
```js
return useQuery({
  queryKey: ['batches', sheet],
  queryFn: () => fetchAllBatches(sheet),
  staleTime: STALE_TIME,
  enabled: Boolean(sheet),
});
```

**Why this improves the codebase**  
The current approach is reasonable for tiny static datasets because tab switching is instant, but it ignores the server's sheet filter and scales poorly if either workbook grows. If datasets stay small, keep it and document the tradeoff; otherwise query by sheet and prefetch the sibling tab opportunistically.


## Performance


### PERF-01 — Scheduled polling intentionally bypasses the server cache on every interval

- **File path:** `client/src/hooks/useStatusReport.js; client/src/utils/constants.js; server/controllers/statusReportController.js`
- **Issue category:** Performance
- **Severity:** **High**

**Current code/problem**
```js
statusReportFresh: () => `${API_BASE}/status-report?fresh=true`
...
// every interval uses fresh=true
```

**Improved code/recommended fix**
```js
// Normal polling:
queryFn: fetchStatusReport,
refetchInterval: STATUS_REPORT_REFRESH_INTERVAL_MS,

// Manual refresh only:
const refresh = () => api.get('/status-report?fresh=true');

// Server cache TTL should be slightly below/at the polling interval.
```

**Why this improves the codebase**  
The server cache cannot reduce database load if every active browser intentionally bypasses it every 10 seconds. With N users, the database sees roughly N live queries per poll interval. Use cached polling and reserve forced refresh for explicit user actions or a server-side refresh worker.


### PERF-02 — Concurrent cache misses/forced refreshes are not coalesced

- **File path:** `server/controllers/statusReportController.js; server/services/cacheService.js`
- **Issue category:** Performance
- **Severity:** **High**

**Current code/problem**
```js
const cached = cache.get(CACHE_KEY);
if (!fresh && cached) return res.json(...);

const rows = await queryDb2(STATUS_REPORT_SQL);
cache.set(CACHE_KEY, rows, ttl);
```

**Improved code/recommended fix**
```js
let inFlight = null;

async function loadStatusRows() {
  if (!inFlight) {
    inFlight = queryStatusDb(buildStatusReportSql(getBackend()))
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}
```

**Why this improves the codebase**  
When multiple clients poll after expiry—or all send `fresh=true`—each request can run the same database query. A single-flight promise collapses simultaneous refreshes into one query and materially reduces load spikes.


### PERF-03 — DB2 path opens and closes a new connection for every status query

- **File path:** `server/services/db2Service.js`
- **Issue category:** Performance
- **Severity:** **Medium**

**Current code/problem**
```js
const conn = await openDb2Connection();
try {
  return await query(conn, sql);
} finally {
  conn.close();
}
```

**Improved code/recommended fix**
```js
// Prefer a supported DB2 pool / long-lived connection abstraction.
const pool = createDb2Pool(db2Config);

async function queryStatusDb(sql, params = []) {
  const conn = await pool.acquire();
  try { return await query(conn, sql, params); }
  finally { pool.release(conn); }
}
```

**Why this improves the codebase**  
At a 10-second polling interval, connection establishment can dominate query cost and amplify database pressure. Use the IBM driver’s supported pooling/connection reuse strategy and close the pool on process shutdown.


### PERF-04 — Filesystem stat/write calls block the Node event loop on request paths

- **File path:** `server/services/excelService.js`
- **Issue category:** Performance
- **Severity:** **Medium**

**Current code/problem**
```js
fs.existsSync(filePath);
fs.statSync(filePath);
...
fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(targetFile, buffer);
```

**Improved code/recommended fix**
```js
const stat = await fs.promises.stat(filePath).catch((err) => {
  if (err.code === 'ENOENT') return null;
  throw err;
});
...
await fs.promises.mkdir(targetDir, { recursive: true });
await fs.promises.writeFile(tempFile, buffer);
```

**Why this improves the codebase**  
Synchronous filesystem calls block every other request while they run. The effect is especially visible during large uploads. Use `fs.promises`, and avoid statting both workbooks on every read request—prefer a file watcher or low-frequency refresh mechanism.


### PERF-05 — Mobile BatchTable renders the entire dataset without virtualization/pagination

- **File path:** `client/src/components/BatchTable/BatchTable.jsx`
- **Issue category:** Performance
- **Severity:** **Medium**

**Current code/problem**
```js
{sortedData.map((b) => (
  <BatchCard key={b.batchName} ... />
))}
```

**Improved code/recommended fix**
```js
const PAGE_SIZE = 50;
const visible = sortedData.slice(0, page * PAGE_SIZE);

{visible.map((b) => (
  <BatchCard key={`${b.sheetSource}:${b.batchName}`} ... />
))}
<Button onClick={() => setPage((p) => p + 1)}>Load more</Button>
```

**Why this improves the codebase**  
Desktop has manual virtualization, but mobile mounts every card. This will degrade rapidly with hundreds or thousands of batches. Paginate/infinite-load mobile cards or use one well-tested virtualizer for both form factors.


### PERF-06 — Current code splitting adds an extra initial route chunk without actually deferring a secondary route

- **File path:** `client/src/App.jsx; client/vite.config.mjs`
- **Issue category:** Performance
- **Severity:** **Low**

**Current code/problem**
```js
const Dashboard = lazy(() => import('./pages/Dashboard'));
// Dashboard is the only route and initial screen.
```

**Improved code/recommended fix**
```js
import Dashboard from './pages/Dashboard';

// Lazy-load genuinely secondary heavy features instead:
const StatusReportTab = lazy(() => import('./components/StatusReportTab/StatusReportTab'));
```

**Why this improves the codebase**  
The only route is `/`, so the Dashboard chunk is requested immediately after the shell. The comment claiming the modal bundle waits for later navigation is false. Existing build output also concentrates roughly 423 KB uncompressed in the MUI vendor chunk. Split genuinely optional features (status report, modal tools) rather than the mandatory landing page.


### PERF-07 — Status sorting repeatedly reparses date strings inside comparator calls

- **File path:** `client/src/components/StatusReportTab/StatusReportTab.jsx`
- **Issue category:** Performance
- **Severity:** **Low**

**Current code/problem**
```js
rows.sort((a, b) => {
  const da = parseDateValue(a[colId]);
  const db = parseDateValue(b[colId]);
  ...
});
```

**Improved code/recommended fix**
```js
const decorated = rows.map((row) => ({
  row,
  startMs: parseStatusTimestamp(row.start_time)?.getTime() ?? null,
  endMs: parseStatusTimestamp(row.end_time)?.getTime() ?? null,
}));
decorated.sort((a, b) => compareNullable(a.startMs, b.startMs, direction));
```

**Why this improves the codebase**  
Sort comparators run O(n log n) times, so reparsing the same timestamps repeatedly creates unnecessary CPU/GC work during every poll/search. Decorate rows with normalized sort keys once per data snapshot.


## Security


### SEC-01 — State-changing workbook upload has no authentication or authorization

- **File path:** `server/routes/batchRoutes.js; server/app.js`
- **Issue category:** Security
- **Severity:** **Critical**

**Current code/problem**
```js
router.post(
  '/batches/upload/:sheet',
  upload.single('file'),
  asyncHandler(uploadController.uploadSheet)
);
```

**Improved code/recommended fix**
```js
const { requireUser, requireRole } = require('../middlewares/auth');

router.post(
  '/batches/upload/:sheet',
  requireUser,
  requireRole('batch-admin'),
  upload.single('file'),
  asyncHandler(uploadController.uploadSheet)
);
```

**Why this improves the codebase**  
Anyone who can reach the API can replace the operational Benefits/Tax workbook. Binding Express to loopback is not an authorization control once the service is placed behind a reverse proxy, tunnel, container ingress, or local multi-user host. Protect the mutation endpoint with the application's real SSO/session/JWT middleware and an explicit admin role. If authentication is intentionally delegated to a reverse proxy, enforce and verify the proxy identity header rather than trusting arbitrary requests.


### SEC-02 — Workbook-controlled values are interpolated into copyable shell commands without shell escaping

- **File path:** `client/src/utils/constants.js`
- **Issue category:** Security
- **Severity:** **High**

**Current code/problem**
```js
export function buildQclientLine(batch, action) {
  const parts = ['sudo', './qclient.sh', action, batch.batchName, batch.scheduleName];
  if (batch.arguments && batch.arguments.trim()) {
    parts.push(`"${batch.arguments.trim()}"`);
  }
  return parts.join(' ');
}
```

**Improved code/recommended fix**
```js
const QCLIENT_ACTIONS = new Set(['runJobOnly', 'resumeJob']);

function shQuote(value) {
  return `'${String(value ?? '').replace(/'/g, `'\"'\"'`)}'`;
}

export function buildQclientLine(batch, action) {
  if (!QCLIENT_ACTIONS.has(action)) throw new Error('Unsupported qclient action');
  if (!batch.batchName || !batch.scheduleName) throw new Error('Batch and schedule are required');

  const parts = [
    'sudo', './qclient.sh', action,
    shQuote(batch.batchName),
    shQuote(batch.scheduleName),
  ];
  if (batch.arguments?.trim()) parts.push(shQuote(batch.arguments.trim()));
  return parts.join(' ');
}
```

**Why this improves the codebase**  
The workbook is an input boundary. A batch name, schedule, or argument containing `;`, `$()`, backticks, quotes, spaces, or shell metacharacters can change the meaning of a command after an operator pastes it into a shell. The application does not execute the command itself, so this is not direct RCE, but combined with an upload path it creates a realistic operator-command-injection chain. Quote every data token and whitelist the action.


### SEC-03 — `xlsx@0.18.5` has known high-severity parser vulnerabilities on the upload path

- **File path:** `package.json; server/utils/fileParser.js`
- **Issue category:** Security
- **Severity:** **High**

**Current code/problem**
```js
"xlsx": "^0.18.5"

// fileParser.js
const xlsxResult = parseWithXLSXLibrary(buffer, defaultSheetSource);
```

**Improved code/recommended fix**
```js
// Preferred: remove SheetJS if ExcelJS covers every required input format.
// Otherwise pin a fixed SheetJS CE tarball:
"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
```

**Why this improves the codebase**  
The server parses user-supplied workbooks. `xlsx` 0.18.5 falls in the affected ranges for GHSA-4r6h-8v6p-xvw6 (prototype pollution, affected <0.19.3) and GHSA-5pgg-2g8v-p4x9 (ReDoS, affected <0.20.2). The npm package is stale; SheetJS documents 0.20.3 via its CDN. Because this code parses untrusted uploads, this is an exposed dependency risk rather than a theoretical transitive advisory.


### SEC-04 — Upload uses 50 MB in-memory buffering per request

- **File path:** `server/routes/batchRoutes.js`
- **Issue category:** Security
- **Severity:** **High**

**Current code/problem**
```js
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});
```

**Improved code/recommended fix**
```js
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, process.env.UPLOAD_TMP_DIR || '/tmp'),
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.upload`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
});
```

**Why this improves the codebase**  
A small number of concurrent unauthenticated 50 MB uploads can consume hundreds of MB of heap before parsing begins. Lower the business-appropriate size limit, authenticate before Multer runs, and prefer temporary disk/streaming storage where practical. If these workbooks are normally a few hundred KB, 50 MB is unnecessary attack surface.


### SEC-06 — Production error handler returns internal exception messages to clients

- **File path:** `server/middlewares/errorHandler.js`
- **Issue category:** Security
- **Severity:** **High**

**Current code/problem**
```js
res.status(status).json({
  success: false,
  message: err.message || 'Internal server error',
  ...(isDev && { stack: err.stack }),
});
```

**Improved code/recommended fix**
```js
const status = Number.isInteger(err.status) ? err.status : 500;
const expose = status < 500 || err.expose === true;

res.status(status).json({
  success: false,
  code: err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
  message: expose ? err.message : 'Internal server error',
  ...(isDev && { detail: err.message, stack: err.stack }),
});
```

**Why this improves the codebase**  
DB connection failures and parser/filesystem errors can include host names, ports, SQL/driver details, and paths. The current production handler exposes those strings. Return stable error codes and generic 5xx text; retain full details only in server logs.


### SEC-05 — CORS is unrestricted despite state-changing endpoints

- **File path:** `server/app.js`
- **Issue category:** Security
- **Severity:** **Medium**

**Current code/problem**
```js
app.use(cors());
```

**Improved code/recommended fix**
```js
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean)
);
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error('Origin not allowed'));
  },
  credentials: true,
}));
```

**Why this improves the codebase**  
`cors()` permits every origin. CORS is not authentication, but broad cross-origin access increases exposure and becomes more dangerous once cookies or bearer credentials are added. For a same-origin production deployment, remove CORS entirely; otherwise allow only explicit UI origins.


### SEC-07 — Upload file validation is permissive and internally inconsistent

- **File path:** `server/controllers/uploadController.js`
- **Issue category:** Security
- **Severity:** **Medium**

**Current code/problem**
```js
const isSupportedMime = SUPPORTED_MIME_TYPES.includes(mime);
const isSupportedExt  = VALID_EXTENSIONS.includes(ext);
if (!isSupportedMime && !isSupportedExt) { ... }
```

**Improved code/recommended fix**
```js
if (!VALID_EXTENSIONS.includes(ext)) {
  throw Object.assign(new Error(`Unsupported extension: ${ext}`), { status: 415 });
}
if (!matchesExpectedFileSignature(req.file.buffer, ext)) {
  throw Object.assign(new Error('File content does not match its extension'), { status: 415 });
}
// Parse under strict limits; do not trust client MIME as proof of type.
```

**Why this improves the codebase**  
The route accepts generic MIME types and only requires MIME OR extension to match, so MIME checks do little. ODS is also present in MIME handling but absent from the extension/client contract. Make the supported-format contract explicit, validate extension plus file signature/parser result, and return 415 for unsupported media.


### SEC-08 — PostgreSQL schema is interpolated into connection options without identifier validation

- **File path:** `server/config/pg.config.js`
- **Issue category:** Security
- **Severity:** **Low**

**Current code/problem**
```js
options: `--search_path=${process.env.PG_SCHEMA || 'public'}`,
```

**Improved code/recommended fix**
```js
const schema = process.env.PG_SCHEMA || 'public';
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
  throw new Error('PG_SCHEMA contains invalid characters');
}
options: `--search_path=${schema}`,
```

**Why this improves the codebase**  
Environment variables are normally trusted operator input, so this is lower risk than request injection, but malformed schema values can alter connection options or cause hard-to-diagnose startup failures. Validate configuration identifiers once at startup.


## Error Handling


### ERR-01 — No React error boundary protects the dashboard

- **File path:** `client/src/App.jsx`
- **Issue category:** Error Handling
- **Severity:** **Medium**

**Current code/problem**
```js
<Suspense fallback={...}>
  <Routes>
    <Route path="/" element={<Dashboard />} />
  </Routes>
</Suspense>
```

**Improved code/recommended fix**
```js
<ErrorBoundary
  fallbackRender={({ resetErrorBoundary }) => (
    <FatalError onRetry={resetErrorBoundary} />
  )}
>
  <Suspense fallback={<AppLoading />}>
    <Routes>
      <Route path="/" element={<Dashboard />} />
    </Routes>
  </Suspense>
</ErrorBoundary>
```

**Why this improves the codebase**  
A render exception in a table cell, malformed row, or lazy chunk can unmount the entire React tree. Add an application-level boundary and, optionally, a feature-level boundary around the status report.


### ERR-02 — Manual status refresh is fire-and-forget and removes the active query

- **File path:** `client/src/hooks/useStatusReport.js`
- **Issue category:** Error Handling
- **Severity:** **Medium**

**Current code/problem**
```js
const refresh = useCallback(() => {
  queryClient.removeQueries({ queryKey: QUERY_KEY, exact: true });
  queryClient.fetchQuery({ queryKey: QUERY_KEY, queryFn: fetchStatusReportFresh });
}, [queryClient]);
```

**Improved code/recommended fix**
```js
const refresh = useCallback(async () => {
  try {
    return await query.refetch({ cancelRefetch: true });
  } catch (error) {
    // Let React Query retain error state; caller may also surface a toast.
    throw error;
  }
}, [query]);
```

**Why this improves the codebase**  
The current callback does not return or catch `fetchQuery()`, so rejection can become unhandled and the UI cannot await it. Removing an active query also discards useful cached state. Refetch the existing query or return the promise from an explicit forced fetch and handle failure.


### ERR-03 — Multer/parser errors are not normalized to stable 4xx/413 responses

- **File path:** `server/middlewares/errorHandler.js; server/routes/batchRoutes.js; tests/upload.integration.test.js`
- **Issue category:** Error Handling
- **Severity:** **Medium**

**Current code/problem**
```js
const status = err.status || 500;
...
expect([400, 500]).toContain(res.status);
```

**Improved code/recommended fix**
```js
if (err instanceof multer.MulterError) {
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
  return res.status(status).json({
    success: false,
    code: err.code,
    message: err.code === 'LIMIT_FILE_SIZE' ? 'Upload is too large' : 'Invalid multipart upload',
  });
}
```

**Why this improves the codebase**  
Client mistakes such as missing multipart boundaries or over-limit files should not surface as ambiguous 500s. Map Multer codes centrally and tighten tests to one expected contract.


### ERR-04 — Health check reports OK even when core workbook bootstrap failed

- **File path:** `server/app.js`
- **Issue category:** Error Handling
- **Severity:** **Medium**

**Current code/problem**
```js
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', ts: new Date().toISOString() })
);
...
catch (err) {
  console.warn('[startup] Server starting with empty batch store.');
}
```

**Improved code/recommended fix**
```js
let ready = false;
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/ready', (_req, res) => {
  if (!ready) return res.status(503).json({ status: 'not-ready' });
  return res.json({ status: 'ready' });
});

await excelService.loadFromFiles(...);
ready = true;
```

**Why this improves the codebase**  
Liveness and readiness are different. A process can be alive while serving an empty dashboard because required files failed to load. Expose a readiness signal that reflects core startup dependencies, and decide explicitly whether degraded startup is acceptable.


### ERR-05 — API error interceptor destroys structured Axios error metadata

- **File path:** `client/src/services/apiService.js`
- **Issue category:** Error Handling
- **Severity:** **Medium**

**Current code/problem**
```js
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Unexpected error';
    return Promise.reject(new Error(message));
  }
);
```

**Improved code/recommended fix**
```js
export class ApiError extends Error {
  constructor(message, { status, code, cause } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

api.interceptors.response.use(
  (r) => r,
  (error) => Promise.reject(new ApiError(
    error.response?.data?.message || 'Request failed',
    {
      status: error.response?.status,
      code: error.response?.data?.code || error.code,
      cause: error,
    }
  ))
);
```

**Why this improves the codebase**  
Replacing Axios errors with a plain `Error` discards HTTP status, server error code, cancellation/network details, and response metadata. The UI then string-matches DB2 error messages. Preserve structured metadata so presentation logic can branch on stable codes.


### ERR-07 — Startup logs configuration failures but continues in a misleading degraded state

- **File path:** `server/app.js; server/services/db2Service.js`
- **Issue category:** Error Handling
- **Severity:** **Medium**

**Current code/problem**
```js
catch (err) {
  console.error(`[startup] Failed to load Excel files: ${err.message}`);
  console.warn('[startup] Server starting with empty batch store.');
}
logStartupMode();
```

**Improved code/recommended fix**
```js
if (process.env.ALLOW_DEGRADED_STARTUP === 'true') {
  startupState.batchDataReady = false;
} else {
  throw err;
}

// Validate selected DB backend configuration before listen().
validateRuntimeConfig();
```

**Why this improves the codebase**  
A production process can become “healthy” while its core data failed to load or the selected database backend is invalid. Fail fast by default. If degraded startup is intentional, make it an explicit flag and expose degraded readiness.


### ERR-06 — Clipboard feedback timer is not cleaned up and copy failure is silent

- **File path:** `client/src/hooks/useCopyToClipboard.js; client/src/utils/helpers.js`
- **Issue category:** Error Handling
- **Severity:** **Low**

**Current code/problem**
```js
if (ok) {
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}
```

**Improved code/recommended fix**
```js
const timerRef = useRef();

useEffect(() => () => clearTimeout(timerRef.current), []);

const copy = useCallback(async (text) => {
  clearTimeout(timerRef.current);
  const ok = await copyToClipboard(text);
  if (!ok) return false;
  setCopied(true);
  timerRef.current = setTimeout(() => setCopied(false), 2000);
  return true;
}, []);
```

**Why this improves the codebase**  
Repeated copies create overlapping timers, and a timer can call state setters after unmount. Returning success/failure also lets the caller show a real error when clipboard permissions are denied instead of silently doing nothing.


## Maintainability & Documentation


### MAINT-02 — Tests copy production algorithms instead of importing them

- **File path:** `tests/statusReportTab.test.js; tests/batchSorting.test.js`
- **Issue category:** Maintainability & Documentation
- **Severity:** **High**

**Current code/problem**
```js
// statusReportTab.test.js redefines:
function getRowStatus(...) { ... }
function parseDateValue(...) { ... }
function sortRows(...) { ... }

// batchSorting.test.js redefines compareValues/requestSort
```

**Improved code/recommended fix**
```js
// Move pure logic to importable modules:
const {
  getRowStatus,
  parseStatusTimestamp,
  sortStatusRows,
} = require('../shared/statusLogic');

test('killed rows are not OK', () => {
  expect(getRowStatus({ killed_flag: 'Y', biz_error_flag: 'N' })).toBe('Killed');
});
```

**Why this improves the codebase**  
A copied implementation can pass while the real implementation is broken; that is exactly what is happening around status classification and date logic. Tests should execute production functions, not a parallel version of them. Extract pure logic into modules compatible with the test runner or configure Jest/Vitest for client modules.


### MAINT-03 — Upload integration tests write to tracked production fixture paths

- **File path:** `tests/upload.integration.test.js; server/services/excelService.js; data/benefits.xlsx; data/tax.xlsx`
- **Issue category:** Maintainability & Documentation
- **Severity:** **High**

**Current code/problem**
```js
await request(app)
  .post('/api/batches/upload/benefits')
  .attach('file', buffer, 'benefits.xlsx');
// service persists to DATA_DIR / tracked data/*.xlsx
```

**Improved code/recommended fix**
```js
let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'batch-dashboard-'));
  process.env.DATA_DIR = tmpDir;
});

afterEach(async () => {
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});
```

**Why this improves the codebase**  
The test exercises the real persistence path and does not restore files on disk. The audited archive is already dirty (`git status` shows `M data/benefits.xlsx`), consistent with this class of side effect. Tests must use isolated temporary directories or injected repositories, never mutate tracked fixtures.


### MAINT-06 — Schedule-parser tests codify known incorrect semantics

- **File path:** `tests/scheduleParser.test.js; tests/currentTasks.integration.test.js`
- **Issue category:** Maintainability & Documentation
- **Severity:** **High**

**Current code/problem**
```js
// Exact scheduled time advances to next day and is expected idle.
expect(result.status).toBe('idle');
```

**Improved code/recommended fix**
```js
test('exact scheduled time is active', () => {
  const now = new Date('2026-10-05T06:00:00-05:00');
  const result = parseSchedule('benefits_daily_6am', now);
  expect(result.status).toBe('active');
});

test('biweekly cadence stays anchored', () => {
  // assert against a known anchor, not now + 14 days
});
```

**Why this improves the codebase**  
Tests are valuable only if expected behavior is correct. Current tests protect the future-only implementation, making a real fix look like a regression. Rewrite expectations from business requirements before refactoring the parser.


### MAINT-01 — README materially disagrees with the codebase

- **File path:** `README.md`
- **Issue category:** Maintainability & Documentation
- **Severity:** **Medium**

**Current code/problem**
```js
Examples of documented claims:
- Node >=18
- exactly three workbook columns
- 5-minute status-report cache
- AppHeader theme toggle is available
- SummaryCards/Recharts behavior
- unlisted schedules are flagged in the UI
```

**Improved code/recommended fix**
```js
# Maintain one "Runtime contract" section generated/verified from code:
- Node: ^20.19 || >=22.12
- Workbook columns: Batch Name, Arguments, Schedule, Trigger Needed
- Poll/cache semantics: exact env names and defaults
- Enabled UI features only
- Supported schedule semantics and known limitations
```

**Why this improves the codebase**  
This is operational software; README inaccuracies can cause deployment and support failures. The current docs are not just cosmetically stale—they describe features and validation that do not exist. Rewrite against the actual runtime and add documentation checks to release review.


### MAINT-04 — Some tests can pass without asserting the target row, and upload tests allow 500 as success criteria

- **File path:** `tests/currentTasks.integration.test.js; tests/upload.integration.test.js`
- **Issue category:** Maintainability & Documentation
- **Severity:** **Medium**

**Current code/problem**
```js
if (row) {
  expect(row.currentTask.frequency).toBe(...);
}
...
expect([400, 422, 500]).toContain(res.status);
```

**Improved code/recommended fix**
```js
expect(row).toBeDefined();
expect(row.currentTask.frequency).toBe(...);

expect(res.status).toBe(422);
expect(res.body.code).toBe('INVALID_WORKBOOK');
```

**Why this improves the codebase**  
Conditional assertions silently skip the actual behavior when fixtures drift. Accepting multiple statuses including 500 hides error-contract regressions. Tests should fail loudly when their preconditions or exact HTTP semantics are wrong.


### MAINT-05 — No lint, formatting, type-checking, client component-test, or CI quality gate exists

- **File path:** `package.json; client/package.json; repository root`
- **Issue category:** Maintainability & Documentation
- **Severity:** **Medium**

**Current code/problem**
```js
"scripts": {
  "test": "cross-env NODE_ENV=test jest tests/"
}
// no lint/typecheck/test:client/CI workflow
```

**Improved code/recommended fix**
```js
"scripts": {
  "lint": "eslint "server/**/*.js" "client/src/**/*.{js,jsx}" "tests/**/*.js"",
  "format:check": "prettier --check .",
  "test:server": "jest tests/",
  "test:client": "vitest run",
  "build": "npm --prefix client run build",
  "check": "npm run lint && npm run test:server && npm run test:client && npm run build"
}
```

**Why this improves the codebase**  
This explains several easy-to-catch issues: unused imports, unreachable code, copied tests, and dead dependencies. Add automated static checks and run them from CI on every pull request. PropTypes help runtime validation but do not replace static typing; TypeScript or `checkJs` can be phased in for API/model boundaries.


### MAINT-07 — Tracked standalone workbook fixtures are inconsistent with the canonical combined workbook

- **File path:** `data/batches.xlsx; data/benefits.xlsx; data/tax.xlsx`
- **Issue category:** Maintainability & Documentation
- **Severity:** **Medium**

**Current code/problem**
```js
Inspection:
- data/batches.xlsx: Benefits + Tax sheets, 22 rows each, 4 columns.
- data/benefits.xlsx: currently 1 row, legacy-ish headers.
- data/tax.xlsx: currently 1 row, upload-test-like content.
```

**Improved code/recommended fix**
```js
# After fixing test isolation, regenerate all fixtures from one canonical source:
npm run generate-sample
git diff --exit-code data/
```

**Why this improves the codebase**  
The combined fixture reflects the current four-column model, while standalone workbooks in the delivered tree do not represent the same dataset. That makes manual upload tests and docs unreliable. Generate all three from one source and add a deterministic fixture-generation check.


### MAINT-08 — No test directly mounts the React components where several defects live

- **File path:** `client/src/components/**; tests/`
- **Issue category:** Maintainability & Documentation
- **Severity:** **Medium**

**Current code/problem**
```js
tests/statusReportTab.test.js
// pure copied helper tests; no render(<StatusReportTab ... />)
```

**Improved code/recommended fix**
```js
import { render, screen } from '@testing-library/react';

test('keeps cached status rows visible during background fetch', () => {
  render(<StatusReportTabForTest isFetching rows={[row]} />);
  expect(screen.getByText(row.job_name)).toBeVisible();
});
```

**Why this improves the codebase**  
The suite is primarily server/integration plus duplicated pure logic. It does not exercise React rendering behavior such as background-fetch flicker, modal race behavior, invalid stored tab values, or error boundaries. Add focused component tests with React Testing Library/Vitest.


### MAINT-09 — No explicit graceful shutdown path closes HTTP/DB resources

- **File path:** `server/app.js; server/config/pg.config.js; server/services/db2Service.js`
- **Issue category:** Maintainability & Documentation
- **Severity:** **Medium**

**Current code/problem**
```js
app.listen(PORT, '127.0.0.1', ...);
// pg closePool exists but is not wired to SIGTERM/SIGINT.
```

**Improved code/recommended fix**
```js
const server = app.listen(PORT, HOST);

async function shutdown(signal) {
  console.log(`[server] ${signal}; shutting down`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
```

**Why this improves the codebase**  
Containers and service managers terminate processes with signals. Without shutdown hooks, in-flight requests can be cut off and database pools are not closed deliberately. Wire resource cleanup into the process lifecycle after splitting startup from app creation.


## Dependencies & Configuration


### DEP-01 — Root Node engine range is incompatible with Vite 8

- **File path:** `package.json; client/package.json`
- **Issue category:** Dependencies & Configuration
- **Severity:** **High**

**Current code/problem**
```js
"engines": {
  "node": ">=18.0.0"
}
...
"vite": "^8.3.1"
```

**Improved code/recommended fix**
```js
"engines": {
  "node": "^20.19.0 || >=22.12.0"
}
```

**Why this improves the codebase**  
Vite 8 officially requires Node 20.19+ or 22.12+. The root package advertises Node 18 as supported, so a compliant install can still fail to run/build the client. Align the root engine, README, CI matrix, and deployment runtime to Vite's actual requirement.


### DEP-02 — Live DB2 mode depends on `ibm_db`, but it is not declared in package.json

- **File path:** `package.json; server/services/db2Service.js`
- **Issue category:** Dependencies & Configuration
- **Severity:** **High**

**Current code/problem**
```js
let ibmdb;
try {
  ibmdb = require('ibm_db');
} catch (...) {
  // instruct operator to install manually
}
```

**Improved code/recommended fix**
```js
"dependencies": {
  "ibm_db": "<vetted-compatible-version>",
  ...
}

// If DB2 is optional in some deployments, use optionalDependencies
// and fail startup when STATUS_REPORT_DB=db2 but the package is absent.
```

**Why this improves the codebase**  
A clean `npm ci` cannot produce a complete live-DB2 runtime from the manifest. Manual post-install instructions are configuration drift. Declare the driver explicitly (normal or optional dependency based on deployment policy) and validate it during startup when DB2 mode is selected.


### DEP-03 — Client environment configuration is placed at repository root, but Vite root is `client/`

- **File path:** `client/vite.config.mjs; .env.example; client/src/utils/constants.js`
- **Issue category:** Dependencies & Configuration
- **Severity:** **High**

**Current code/problem**
```js
// vite.config.mjs
export default defineConfig({
  plugins: [react()],
  ...
});

// constants.js
export const API_BASE = '/api';
```

**Improved code/recommended fix**
```js
export default defineConfig({
  envDir: '..',
  plugins: [react()],
  ...
});

// constants.js
export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
```

**Why this improves the codebase**  
By default Vite loads env files relative to the project root (`client/` here), while `.env`/`.env.example` live one directory above. `VITE_API_BASE_URL` is also documented but ignored because `API_BASE` is hardcoded. Either set `envDir: '..'` deliberately or move client env files under `client/`; then actually consume the variable.


### DEP-04 — Sample-data generators disagree on the workbook schema and can overwrite good fixtures with stale data

- **File path:** `scripts/generateTestData.js; data/generateSample.js; data/regenerateData.js`
- **Issue category:** Dependencies & Configuration
- **Severity:** **High**

**Current code/problem**
```js
// scripts/generateTestData.js documents and writes only 3 columns:
H_NAME, H_ARGS, H_SCHED
// package script:
"generate-sample": "node scripts/generateTestData.js"
```

**Improved code/recommended fix**
```js
// Keep ONE canonical generator:
const HEADERS = [
  'Batch Name/Job Name',
  'Batch Arguments/JVM Arguments',
  'Schedule Name/ Job Group Name',
  'Trigger Needed',
];

// package.json
"generate-sample": "node data/regenerateData.js"
```

**Why this improves the codebase**  
The current application model includes `Trigger Needed`, but the main package script points to a generator that omits it, while another generator writes the four-column schema and `data/generateSample.js` represents an older legacy shape. Consolidate to one generator and one shared fixture definition to prevent destructive schema rollback.


### DEP-06 — Delivered archive contains hundreds of MB of ignored install/build artifacts and they are not reproducible

- **File path:** `node_modules/; client/node_modules/; client/dist/`
- **Issue category:** Dependencies & Configuration
- **Severity:** **Medium**

**Current code/problem**
```js
Archive contents:
node_modules/        ~166 MB
client/node_modules/ ~295 MB
client/dist/         ~596 KB
```

**Improved code/recommended fix**
```js
# Deliver source + lockfiles, then validate from clean state:
rm -rf node_modules client/node_modules client/dist
npm ci
npm --prefix client ci
npm test -- --runInBand
npm --prefix client run build
```

**Why this improves the codebase**  
The checked-in Git ignore rules are correct, but the uploaded archive still bundled platform-specific installs/build output. In this environment, the bundled root install could not start Jest's runner cleanly and the bundled client install failed Vite/Rolldown native binding resolution. Those failures do not prove a clean install is broken; they prove the archive's `node_modules` is not a reliable build artifact. Ship source/lockfiles and validate clean installs in CI.


### DEP-07 — Unknown `STATUS_REPORT_DB` values silently fall back to DB2

- **File path:** `server/services/db2Service.js`
- **Issue category:** Dependencies & Configuration
- **Severity:** **Medium**

**Current code/problem**
```js
function getBackend() {
  const val = (process.env.STATUS_REPORT_DB || 'db2').toLowerCase().trim();
  return val === 'pg' ? 'pg' : 'db2';
}
```

**Improved code/recommended fix**
```js
function getBackend() {
  const val = (process.env.STATUS_REPORT_DB || 'db2').toLowerCase().trim();
  if (!['db2', 'pg'].includes(val)) {
    throw new Error(`STATUS_REPORT_DB must be "db2" or "pg"; received "${val}"`);
  }
  return val;
}
```

**Why this improves the codebase**  
A typo such as `postgres` or `pgg` silently selects DB2, potentially connecting to the wrong backend or producing confusing credential failures. Configuration errors should fail fast at startup.


### DEP-05 — Three direct client dependencies are installed but not imported

- **File path:** `client/package.json`
- **Issue category:** Dependencies & Configuration
- **Severity:** **Low**

**Current code/problem**
```js
"@mui/x-date-pickers": "^7.16.0",
"date-fns": "^3.6.0",
"react-window": "^2.3.3"
```

**Improved code/recommended fix**
```js
npm --prefix client uninstall @mui/x-date-pickers date-fns react-window
```

**Why this improves the codebase**  
Source-reference analysis found zero imports for these packages. Remove them unless a near-term branch actually needs them. Separately, plan major framework/library upgrades as deliberate migrations rather than mixing them into this correctness/security cleanup.


### DEP-08 — Root `.env` and `.env.example` have drifted, so local behavior depends on undocumented defaults

- **File path:** `.env; .env.example`
- **Issue category:** Dependencies & Configuration
- **Severity:** **Low**

**Current code/problem**
```js
# .env.example documents PG/status-report settings
# local .env in the archive does not contain the full current set
```

**Improved code/recommended fix**
```js
# Keep .env untracked.
# Generate/update it from .env.example and validate config at startup:
const required = schema.parse(process.env);
```

**Why this improves the codebase**  
No exposed non-empty credential was found in the audited environment file, which is good. The problem is configuration drift: the example has evolved while the local file has not. Use a startup schema (Zod/Joi/Valibot or a small validator) to make required and optional settings explicit instead of relying on silent defaults.


### DEP-09 — Package scripts use `npm install` for the canonical all-install flow instead of lockfile-reproducible installs

- **File path:** `package.json`
- **Issue category:** Dependencies & Configuration
- **Severity:** **Low**

**Current code/problem**
```js
"install:all": "npm install && npm --prefix client install"
```

**Improved code/recommended fix**
```js
"install:all": "npm ci && npm --prefix client ci"
```

**Why this improves the codebase**  
For a deployed operations dashboard, the lockfiles should define the exact dependency graph. Keep an optional developer update script if needed, but CI/release/bootstrap instructions should use `npm ci` so installs are reproducible.


# File-by-file audit coverage

Every Git-tracked file in the uploaded repository was included in the review. “No additional material issue” means the file was reviewed and any relevant cross-cutting finding is already captured elsewhere; it does **not** mean the file is guaranteed bug-free.

| File | Audit disposition |
|---|---|
| `.env.example` | Findings: DEP-03, DEP-08 |
| `.gitignore` | Reviewed; ignore rules cover node_modules, dist, .env and uploads appropriately. No material defect found. |
| `README.md` | Findings: MAINT-01 |
| `client/index.html` | Reviewed; minimal Vite entry document. No material defect found. |
| `client/package-lock.json` | Reviewed as generated dependency lockfile; do not hand-edit. Dependency findings are addressed through manifests/clean reinstall. |
| `client/package.json` | Findings: DEAD-06, MAINT-05, DEP-01, DEP-05 |
| `client/src/App.jsx` | Findings: DEAD-01, QUAL-03, PERF-06, ERR-01 |
| `client/src/components/AppHeader/AppHeader.jsx` | Findings: DEAD-01 |
| `client/src/components/BatchDetailModal/BatchDetailModal.jsx` | Reviewed; no additional material issue beyond cross-cutting findings. |
| `client/src/components/BatchTable/BatchTable.jsx` | Findings: LOG-07, DEAD-05, PERF-05 |
| `client/src/components/CommandViewer/CommandViewer.jsx` | Findings: LOG-02 |
| `client/src/components/CurrentTaskBadge/CurrentTaskBadge.jsx` | Reviewed; no additional material issue beyond cross-cutting findings. |
| `client/src/components/SearchBar/SearchBar.jsx` | Reviewed; no additional material issue beyond cross-cutting findings. |
| `client/src/components/SheetTabs/SheetTabs.jsx` | Findings: QUAL-04, QUAL-06 |
| `client/src/components/StatusReportTab/StatusReportTab.jsx` | Findings: LOG-05, LOG-06, LOG-08, LOG-09, LOG-10, LOG-23, ARCH-01, QUAL-01, PERF-07, QUAL-05 |
| `client/src/components/SummaryCards/SummaryCards.jsx` | Findings: LOG-22, DEAD-02 |
| `client/src/context/BatchContext.jsx` | Findings: LOG-03, LOG-04, QUAL-04 |
| `client/src/context/ThemeContext.jsx` | Reviewed; no additional material issue beyond cross-cutting findings. |
| `client/src/hooks/useBatches.js` | Findings: DEAD-02, DEAD-03, DEAD-05, ARCH-04 |
| `client/src/hooks/useCopyToClipboard.js` | Findings: ERR-06 |
| `client/src/hooks/useSort.js` | Reviewed; no additional material issue beyond cross-cutting findings. |
| `client/src/hooks/useStatusReport.js` | Findings: PERF-01, ERR-02 |
| `client/src/main.jsx` | Reviewed as client reachability root; no material defect beyond app-level findings. |
| `client/src/pages/Dashboard.jsx` | Findings: ARCH-01 |
| `client/src/services/apiService.js` | Findings: DEAD-02, DEAD-03, ERR-05 |
| `client/src/utils/constants.js` | Findings: SEC-02, DEAD-03, PERF-01, DEP-03 |
| `client/src/utils/helpers.js` | Findings: LOG-01, DEAD-03, QUAL-03, ERR-06 |
| `client/vite.config.mjs` | Findings: PERF-06, DEP-03 |
| `data/batches.xlsx` | Binary workbook inspected structurally: 22 Benefits + 22 Tax rows, current four-column schema, no duplicate batch names in this combined fixture. |
| `data/benefits.xlsx` | Binary workbook inspected; inconsistent with canonical combined fixture and Git working tree is modified. See MAINT-03/MAINT-07. |
| `data/generateSample.js` | Findings: DEP-04 |
| `data/regenerateData.js` | Findings: DEP-04 |
| `data/tax.xlsx` | Binary workbook inspected; standalone fixture is inconsistent with canonical combined workbook. See MAINT-07. |
| `package-lock.json` | Reviewed as generated dependency lockfile; do not hand-edit. Dependency findings are addressed through manifests/clean reinstall. |
| `package.json` | Findings: SEC-03, DEAD-06, MAINT-05, DEP-01, DEP-02, DEP-05, DEP-09 |
| `scripts/generateTestData.js` | Findings: DEP-04 |
| `server/app.js` | Findings: SEC-01, SEC-05, ARCH-02, QUAL-03, ERR-04, ERR-07, MAINT-09 |
| `server/config/columnMapping.config.js` | Reviewed; no additional material issue beyond cross-cutting findings. |
| `server/config/constants.js` | Findings: DEAD-04 |
| `server/config/db2.config.js` | Findings: LOG-11 |
| `server/config/pg.config.js` | Findings: LOG-11, SEC-08, MAINT-09 |
| `server/controllers/batchController.js` | Findings: LOG-17, ARCH-03 |
| `server/controllers/currentTasksController.js` | Findings: DEAD-05, ARCH-03 |
| `server/controllers/statusReportController.js` | Findings: LOG-11, PERF-01, PERF-02 |
| `server/controllers/uploadController.js` | Findings: SEC-07, ARCH-03 |
| `server/middlewares/errorHandler.js` | Findings: SEC-06, ERR-03 |
| `server/models/batchModel.js` | Findings: LOG-14, DEAD-04 |
| `server/routes/batchRoutes.js` | Findings: SEC-01, SEC-04, DEAD-06, ERR-03 |
| `server/services/cacheService.js` | Findings: PERF-02 |
| `server/services/db2Service.js` | Findings: PERF-03, DEP-02, DEP-07, ERR-07, MAINT-09 |
| `server/services/excelService.js` | Findings: LOG-12, LOG-13, LOG-14, LOG-22, PERF-04, MAINT-03, LOG-24, ARCH-05 |
| `server/services/mockData.js` | Findings: LOG-21 |
| `server/utils/fileParser.js` | Findings: SEC-03, LOG-15, LOG-16, QUAL-02, QUAL-03, LOG-25 |
| `server/utils/scheduleParser.js` | Findings: LOG-18, LOG-19, LOG-20 |
| `tests/batchSorting.test.js` | Findings: MAINT-02 |
| `tests/currentTasks.integration.test.js` | Findings: MAINT-04, MAINT-06 |
| `tests/scheduleParser.test.js` | Findings: MAINT-06 |
| `tests/statusReport.integration.test.js` | Reviewed; no additional material issue beyond cross-cutting findings. |
| `tests/statusReportTab.test.js` | Findings: MAINT-02 |
| `tests/triggerNeeded.test.js` | Reviewed; no additional material issue beyond cross-cutting findings. |
| `tests/upload.integration.test.js` | Findings: ERR-03, MAINT-03, MAINT-04 |

## Archive-only / ignored content reviewed

- `.env`: reviewed for configuration shape. No non-empty exposed credential was identified in the audited copy; configuration drift is covered by `DEP-03`/`DEP-08`. It remains correctly ignored by Git.
- `node_modules/` (~166 MB) and `client/node_modules/` (~295 MB): ignored by Git but included in the uploaded archive; non-portable install state covered by `DEP-06`.
- `client/dist/` (~596 KB): ignored generated output; existing chunks total roughly 578 KB uncompressed JavaScript, with the MUI/Emotion vendor chunk roughly 423 KB. Treat the build as disposable output.
- `.git/`: used only to establish tracked-file coverage and detect the dirty workbook fixture. No repository history changes were made.

# Dependency/configuration evidence

The dependency findings that rely on current external requirements/advisories were verified against authoritative sources:

- **Vite 8 Node requirement:** Vite 8 documentation states Node.js **20.19+ or 22.12+** is required: https://v8.vite.dev/guide/
- **SheetJS prototype pollution:** GitHub Advisory `GHSA-4r6h-8v6p-xvw6`, affected `xlsx < 0.19.3`: https://github.com/advisories/GHSA-4r6h-8v6p-xvw6
- **SheetJS ReDoS:** GitHub Advisory `GHSA-5pgg-2g8v-p4x9`, affected `xlsx < 0.20.2`: https://github.com/advisories/GHSA-5pgg-2g8v-p4x9
- **SheetJS current CE installation:** official docs provide `xlsx-0.20.3` from the SheetJS CDN: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/

I did **not** label every older-but-supported package as a defect. Major-version upgrades (React/MUI/Express/etc.) should be planned separately and justified by compatibility/security needs rather than performed as drive-by churn.

# Overall code health score justification

**4.7 / 10**

What keeps it above a failing score: the project has a coherent small-system structure, readable naming in many modules, sensible separation between controllers/services/models, centralized React Query usage, server-side tests covering several routes, Git ignores that are fundamentally correct, and no hardcoded non-empty credential discovered in the supplied environment file.

What prevents a production-grade score: one critical unauthorized mutation path; a high-risk generated-shell-command trust boundary; high-severity vulnerable spreadsheet parsing on user-controlled uploads; multiple incorrect operational status/schedule behaviors; non-durable upload success semantics; mutable-store races; a backend abstraction that does not actually honor its DB configuration; test isolation failures; copied test implementations; dead UI/features; and environment/runtime documentation that is materially inconsistent.

A realistic target after the P0/P1 work is **7.5–8.0/10** without a rewrite. Reaching **9/10** would require clean-install CI, stronger type/schema boundaries, authoritative scheduler semantics, robust auth/observability, and removal of the remaining dead/config-drift surface.