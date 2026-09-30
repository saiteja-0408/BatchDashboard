# Batch Job Dashboard

A production-grade, full-stack web application for monitoring and managing scheduled batch jobs across **Benefits** and **Tax** processing domains. Replaces manual Excel-based tracking with a centralized dashboard featuring sorting, filtering, search, current-task status badges, and server command references.

---

## Architecture

```
BatchDashboardUI/
├── server/                          # Express.js backend (strict MVC)
│   ├── app.js                       # Entry point — bootstraps server & loads Excel store
│   ├── config/
│   │   ├── columnMapping.config.js  # Maps Excel column headers → internal model fields
│   │   └── constants.js             # VALID_SCHEDULE_NAMES (128 entries)
│   ├── controllers/
│   │   ├── batchController.js       # Request handlers — getAllBatches, getSummary, search, filter, getByName, upload
│   │   └── currentTasksController.js# GET /api/current-tasks — live schedule status per batch
│   ├── models/
│   │   └── batchModel.js            # Batch data shape + field validation
│   ├── routes/
│   │   └── batchRoutes.js           # Express Router — all /api endpoints
│   ├── services/
│   │   └── excelService.js          # In-memory store; sheet-aware getAll/search/filter/summary
│   ├── utils/
│   │   ├── fileParser.js            # Pure ExcelJS parsing — sheet detection, header normalisation
│   │   └── scheduleParser.js        # Parses all 128 schedule name patterns → {frequency, description, nextRun, status}
│   └── middlewares/
│       └── errorHandler.js          # asyncWrapper + global error handler
├── client/                          # React 18 + Vite frontend
│   ├── vite.config.mjs              # Vite 8 ESM config; proxies /api → backend
│   ├── src/
│   │   ├── App.jsx                  # Root — QueryClient, Theme, Batch providers, Router
│   │   ├── components/
│   │   │   ├── AppHeader/           # Top nav bar — branding, dark mode toggle, upload button
│   │   │   ├── BatchDetailModal/    # Full detail modal — metadata + run/resume commands tabs
│   │   │   ├── BatchTable/          # Sortable table with Current Task column (60s auto-refresh)
│   │   │   ├── CommandViewer/       # qclient.sh command blocks with copy-to-clipboard
│   │   │   ├── CurrentTaskBadge/    # Active/Upcoming/Idle/Unknown status chip with tooltip
│   │   │   ├── FilterPanel/         # Frequency + schedule-validity dropdowns with filter chips
│   │   │   ├── SearchBar/           # Debounced global search input
│   │   │   ├── SheetTabs/           # Benefits / Tax tab selector
│   │   │   ├── SummaryCards/        # Stat cards + Recharts pie charts
│   │   │   └── UploadButton/        # Runtime Excel file reload
│   │   ├── context/
│   │   │   ├── BatchContext.jsx     # activeSheet, searchQuery, filters, modal state
│   │   │   └── ThemeContext.jsx     # MUI dark/light mode toggle
│   │   ├── hooks/
│   │   │   ├── useBatches.js        # React Query hooks: useAllBatches, useSummary, useCurrentTasks
│   │   │   ├── useSort.js           # Multi-column sort: asc → desc → reset cycle
│   │   │   └── useCopyToClipboard.js# Clipboard hook with 2s "Copied!" feedback
│   │   ├── pages/
│   │   │   └── Dashboard.jsx        # Orchestrates all components; applies client-side filters
│   │   ├── services/
│   │   │   └── apiService.js        # Axios wrapper — fetchAllBatches, fetchCurrentTasks, uploadExcelFile, …
│   │   └── utils/
│   │       ├── constants.js         # API paths, VALID_SCHEDULE_NAMES Set, buildCommand, getScheduleFrequency
│   │       └── helpers.js           # formatDate, compareValues, exportToExcel (CSV), copyToClipboard
├── data/
│   ├── batches.xlsx                 # Pre-loaded data: 22 Benefits + 22 Tax rows
│   ├── benefits.xlsx                # Standalone upload test file (Benefits sheet only)
│   └── tax.xlsx                     # Standalone upload test file (Tax sheet only)
├── scripts/
│   └── generateTestData.js          # Regenerates all three Excel files from VALID_SCHEDULE_NAMES
├── tests/
│   ├── scheduleParser.test.js       # 175 unit tests — all schedule name patterns
│   └── currentTasks.integration.test.js # 10 integration tests — /api/current-tasks endpoint
├── package.json                     # Root scripts: dev, test, build:client, start
├── .env                             # Local environment (git-ignored)
└── .env.example                     # Template — copy to .env
```

---

## Prerequisites

- **Node.js ≥ 18** (tested on v18, v20, v22)
- **npm ≥ 9**

---

## Quick Start

### 1. Install dependencies

```bash
# Root (server) dependencies
npm install

# Client dependencies
cd client && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Defaults work out of the box — edit only if you need a different port or Excel path
```

### 3. Run in development mode

```bash
npm run dev
```

This starts two processes concurrently:
- **Express server** on `http://127.0.0.1:4000` (loads `data/batches.xlsx` at startup)
- **Vite dev server** on `http://localhost:3000` (proxies `/api/*` to the backend)

Open **http://localhost:3000** in your browser.

### 4. Production build

```bash
npm run build:client    # builds React → client/dist/
NODE_ENV=production npm start  # Express serves client/dist/ + API on port 4000
```

Open **http://localhost:4000**.

---

## Environment Variables

| Variable           | Default                 | Description                                          |
|--------------------|-------------------------|------------------------------------------------------|
| `PORT`             | `4000`                  | Express server port (binds to 127.0.0.1)             |
| `NODE_ENV`         | `development`           | `development` \| `production`                        |
| `EXCEL_FILE_PATH`  | `./data/batches.xlsx`   | Excel file loaded at startup                         |
| `UPLOAD_DIR`       | `./data/uploads`        | Directory for runtime-uploaded files                 |
| `MAX_FILE_SIZE_MB` | `10`                    | Max upload size in megabytes                         |

---

## Excel File Schema

The application reads Excel files with **exactly three column headers** per sheet:

| Excel Column Header              | Internal Field  | Notes                                       |
|----------------------------------|-----------------|---------------------------------------------|
| `Batch Name/Job Name`            | `batchName`     | Primary key — must be unique within a sheet |
| `Batch Arguments/JVM Arguments`  | `arguments`     | Optional; may be empty                      |
| `Schedule Name/ Job Group Name`  | `scheduleName`  | Must match an entry in `VALID_SCHEDULE_NAMES` for full feature support |

### Sheet detection (automatic, by sheet name)

| Sheet name contains | `sheetSource` | `logDir` |
|---------------------|--------------|----------|
| `benefit` (case-insensitive) | `benefits` | `cd /opt/app/accessms/bin/benefits/batch` |
| `tax` (case-insensitive)     | `tax`       | `cd /opt/app/accessms/bin/tax/batch/`    |

Sheets not matching either pattern are skipped with a startup warning.

### Multi-sheet workbooks

A single workbook may contain both a Benefits sheet and a Tax sheet. The server parses all matching sheets and merges them into the in-memory store with their `sheetSource` set correctly.

---

## Column Mapping Configuration

Edit [`server/config/columnMapping.config.js`](server/config/columnMapping.config.js) to remap Excel column headers to internal field names without touching any other code:

```js
// server/config/columnMapping.config.js
module.exports = {
  COLUMN_MAP: {
    'Batch Name/Job Name':            'batchName',
    'Batch Arguments/JVM Arguments':  'arguments',
    'Schedule Name/ Job Group Name':  'scheduleName',
  },
  SHEET_LOG_PATHS: {
    benefits: 'cd /opt/app/accessms/bin/benefits/batch',
    tax:      'cd /opt/app/accessms/bin/tax/batch/',
  },
};
```

No other file needs to change. The mapping is applied inside [`server/utils/fileParser.js`](server/utils/fileParser.js) at parse time.

---

## API Reference

All endpoints are prefixed with `/api`. The Vite dev proxy forwards all `/api` requests to `http://127.0.0.1:4000`.

| Method | Path                                         | Query params                      | Description                                      |
|--------|----------------------------------------------|-----------------------------------|--------------------------------------------------|
| GET    | `/api/batches`                               | `sheet=benefits\|tax`             | All batches, optionally filtered by sheet        |
| GET    | `/api/batches/summary`                       | —                                 | Dashboard summary stats (total, by sheet, etc.)  |
| GET    | `/api/batches/search`                        | `q=<query>`, `sheet=`             | Full-text search across all fields               |
| GET    | `/api/batches/filter`                        | `sheet=`, `scheduleValid=true\|false` | Filter by schedule validity                  |
| GET    | `/api/batches/:name`                         | `sheet=`                          | Single batch by `batchName` (URL-encoded)        |
| GET    | `/api/current-tasks`                         | `sheet=benefits\|tax`             | All batches with live `currentTask` status       |
| POST   | `/api/upload`                                | —                                 | Upload `.xlsx` file (multipart/form-data)        |
| GET    | `/health`                                    | —                                 | Health check — returns `{ status: "ok" }`        |

### `/api/current-tasks` response shape

```json
{
  "success": true,
  "sheet": "tax",
  "count": 22,
  "serverTime": "2026-09-29T13:05:30.489Z",
  "data": [
    {
      "batchName": "BatchW2DataExtraction",
      "scheduleName": "benefits_daily_5am",
      "sheetSource": "tax",
      "logDir": "cd /opt/app/accessms/bin/tax/batch/",
      "scheduleValid": true,
      "currentTask": {
        "status": "idle",
        "frequency": "daily",
        "description": "Daily at 05:00",
        "nextRun": "2026-09-30T10:00:00.000Z"
      }
    }
  ]
}
```

`currentTask.status` values: `active` (within ±15 min of schedule time) | `upcoming` (within 60 min) | `idle` | `unknown`

---

## Features

### Dashboard
- **Summary Cards**: Total batches, Benefits count, Tax count, unknown-schedule count, Recharts pie charts (by sheet + schedule validity)
- **Sheet Tabs**: Switch between Benefits and Tax; resets search and filters
- **Global Search**: Debounced (350 ms) full-text search across `batchName`, `scheduleName`, and `arguments`
- **Filter Panel**: Frequency dropdown (Daily / Weekly / Monthly / Quarterly / Annual / Bi-weekly / On-demand) and Schedule Validity filter; removable filter chips
- **Export CSV**: Downloads filtered batch list as RFC 4180-compliant CSV

### Batch Table
- **Sortable columns**: Batch Name, Schedule Name, Arguments, Sheet — click to cycle asc → desc → reset
- **Current Task column**: Live status badge (Active / Upcoming / Idle / Unknown) for every row, auto-refreshed every 60 seconds via React Query polling; tooltip shows description and next run time
- **Warning indicator**: Orange left border + warning icon for batches with an unknown schedule name
- **Keyboard navigation**: Tab to rows, Enter to open detail modal
- **Mobile layout**: Card list on viewports < 600 px

### Batch Detail Modal
- **Details tab**: batchName, scheduleName, arguments, sheet, log directory, schedule warning if applicable
- **Run / Resume Commands tab**: Both `runJobOnly` and `resumeJob` command blocks with copy-to-clipboard

### Command Format

Commands follow the exact qclient.sh call pattern:
```
<logDir>
sudo ./qclient.sh <runJobOnly|resumeJob> <batchName> <scheduleName> ["<arguments>"]
```
The arguments portion is omitted entirely when the field is empty.

### Dark Mode
Toggle via the sun/moon icon in the top-right of the header. Preference persists in `localStorage`.

### Excel Upload
Replace the live in-memory data store at runtime via the **Upload Excel** button in the header. The new file is parsed and the store is replaced immediately without restarting the server.

---

## Schedule Name Parser

[`server/utils/scheduleParser.js`](server/utils/scheduleParser.js) handles all 128 entries in `VALID_SCHEDULE_NAMES`. It derives:

| Field         | Example value                             |
|---------------|-------------------------------------------|
| `frequency`   | `daily`, `weekly`, `monthly`, `quarterly`, `annual`, `biweekly`, `on_demand` |
| `description` | `"Daily at 05:00"`, `"Every Monday at 17:15"`, `"Monthly on the 9th day at 06:00"` |
| `nextRun`     | ISO 8601 UTC string of the next scheduled run |
| `status`      | `active` \| `upcoming` \| `idle` \| `unknown` |

Pattern families handled:
1. `*_daily_<time>` — e.g. `benefits_daily_6am`, `benefits_daily_0630pm`
2. `*_weekly_<dow>_<time>` — e.g. `benefits_weekly_monday_515pm`
3. `*_monthly_<Nth>_day[_<time>]` — e.g. `benefits_monthly_8th_day_6am`
4. `*_monthly_2nd_monday_<time>`
5. `*_qtrly_*` — quarterly triggers
6. `*_biweekly_*`
7. `*_tue_sat_*` — multiple days per week
8. `xmatch_*` / `eta_*` — nth-weekday of nth-month of quarter
9. `reports_annual_*`, `top_annual_*`
10. `appeals_reports_<time>`, `corr_webservice_twice_daily`, `email_daily_*`, `workflow_reports_*`
11. `on_demand`, `top_recert`, `user_stat`, `corr_*`, `special_holiday_*`, etc.

---

## Running Tests

```bash
npm test
# → Runs jest tests/ — 185 tests across 2 suites (scheduleParser + currentTasks integration)
```

Test files:
- [`tests/scheduleParser.test.js`](tests/scheduleParser.test.js) — 175 unit tests covering all 128 schedule names and all pattern families
- [`tests/currentTasks.integration.test.js`](tests/currentTasks.integration.test.js) — 10 integration tests for the `/api/current-tasks` endpoint using supertest

---

## Regenerating Sample Data

```bash
node scripts/generateTestData.js
# Regenerates:
#   data/batches.xlsx  (22 Benefits + 22 Tax rows)
#   data/benefits.xlsx (22 Benefits rows)
#   data/tax.xlsx      (22 Tax rows)
```

---

## Security Notes

- Server binds to `127.0.0.1` (never `0.0.0.0`)
- No secrets or credentials in code; all configuration via `.env`
- Stack traces only shown in `NODE_ENV=development`
- Excel parsing uses `exceljs` (no high-severity CVEs); the `xlsx`/SheetJS library was intentionally avoided
- `.env` and `data/uploads/` are git-ignored

---

## Assumptions

1. **Primary key**: `batchName` is the unique identifier within a sheet. Duplicate names in the same sheet use the last occurrence.
2. **Three-column schema**: The Excel files contain exactly the three columns above. Additional columns are silently ignored.
3. **Sheet detection by name**: Sheet tab names must contain `benefit` or `tax` (case-insensitive). A workbook may have both.
4. **Schedule name list**: The 128 entries in `VALID_SCHEDULE_NAMES` are fixed. Rows with unlisted schedule names are loaded but flagged with `scheduleValid: false` and an orange warning indicator.
5. **No authentication**: Internal read-only dashboard — no login flow.
6. **In-memory store**: All data is held in process memory. Restarting the server reloads from the Excel path configured in `.env`. Uploading a new file replaces (not appends to) the in-memory store.
7. **Current-task status is derived at request time**: The `/api/current-tasks` endpoint computes status on-the-fly using the server clock. No historical run data is stored.
8. **Time zone**: `nextRun` timestamps are computed in UTC. The UI renders them in the browser's local time zone via `toLocaleString`.
