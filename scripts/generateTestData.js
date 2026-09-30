/**
 * generateTestData.js
 *
 * Generates three Excel files using the exact column schema the server expects:
 *
 *   Column A: "Batch Name/Job Name"
 *   Column B: "Batch Arguments/JVM Arguments"   (may be empty)
 *   Column C: "Schedule Name/ Job Group Name"
 *
 * Files produced:
 *   data/batches.xlsx   — single file with BOTH a "Benefits" sheet and a "Tax" sheet
 *                         (this is the file the server loads at startup)
 *   data/benefits.xlsx  — standalone Benefits-only file (upload via UI to test reload)
 *   data/tax.xlsx       — standalone Tax-only file       (upload via UI to test reload)
 *
 * Sheet name rules (from fileParser.js):
 *   - Sheet name must contain "benefit" (case-insensitive) → sheetSource = 'benefits'
 *   - Sheet name must contain "tax"     (case-insensitive) → sheetSource = 'tax'
 *
 * Schedule names are drawn exclusively from VALID_SCHEDULE_NAMES in server/config/constants.js.
 *
 * Run:  node scripts/generateTestData.js
 */

'use strict';

const ExcelJS  = require('exceljs');
const path     = require('path');
const fs       = require('fs');

// ── Column headers (must match COLUMN_MAP in columnMapping.config.js exactly) ─
const H_NAME   = 'Batch Name/Job Name';
const H_ARGS   = 'Batch Arguments/JVM Arguments';
const H_SCHED  = 'Schedule Name/ Job Group Name';

// ── Benefits batch rows — 22 realistic entries ───────────────────────────────
// Each row: [batchName, arguments (empty string = omit), scheduleName]
const BENEFITS_ROWS = [
  // Daily enrollment and eligibility
  ['BatchEnrollmentSync',           'ENV=PROD,TENANT=benefits',              'benefits_daily_6am'],
  ['BatchEligibilityLoad',          '',                                       'benefits_daily_8am'],
  ['BatchDependentVerification',    'REPORT_TYPE=FULL',                       'benefits_daily_930am'],
  ['BatchLifeEventProcessor',       '',                                       'benefits_daily_4pm'],
  ['BatchCoverageChangeNotifier',   'NOTIFY=EMAIL,SMS',                       'benefits_daily_515pm'],
  ['BatchBeneficiaryUpdate',        '',                                       'benefits_daily_9pm'],
  ['BatchPremiumCalculation',       'CALC_MODE=STANDARD',                    'benefits_daily_1030am'],
  ['BatchHSAContributionPost',      '',                                       'benefits_daily_0630pm'],

  // Weekly reports and reconciliation
  ['BatchWeeklyEnrollmentReport',   'FORMAT=PDF,RECIPIENT=hr-team@corp.com', 'benefits_weekly_friday_6am'],
  ['BatchCobraEligibilityCheck',    '',                                       'benefits_weekly_monday_6am'],
  ['BatchDentalClaimsReconcile',    'PLAN_YEAR=2024',                        'benefits_weekly_wednesday_6am'],
  ['BatchVisionBenefitsAudit',      '',                                       'benefits_weekly_thursday_9am'],
  ['BatchWellnessIncentiveCalc',    'PROGRAM=WELLNESS2024',                  'benefits_weekly_tuesday_6am'],

  // Monthly reconciliation and reporting
  ['BatchFSABalanceReconcile',      'TAX_YEAR=2024',                         'benefits_monthly_1st_day_6am'],
  ['BatchHRAMonthlyStatement',      '',                                       'benefits_monthly_3rd_day_6am'],
  ['BatchOpenEnrollmentSummary',    'OE_YEAR=2024,FINALIZE=true',            'benefits_monthly_8th_day_6am'],
  ['BatchDependentAuditReport',     'INCLUDE_INACTIVE=false',                'benefits_monthly_15th_day_6am'],
  ['BatchBenefitsCostAnalysis',     '',                                       'benefits_monthly_last_day_7pm'],

  // Quarterly / ad-hoc
  ['BatchQtrlyBenefitsSummary',     'QUARTER=Q2_2024',                       'benefits_qtrly_1st_day'],
  ['BatchACAEligibilityBuild',      'YEAR=2024,EMPLOYER_ID=EMP001',          'benefits_qtrly_9th_day'],
  ['BatchOpenEnrollmentEligLoad',   'FILE=/data/elig/oe2024.csv',            'on_demand'],
  ['BatchBenefitsIconExport',       'EXPORT_TYPE=FULL',                      'benefits_icon_export_10am'],
];

// ── Tax batch rows — 22 realistic entries ────────────────────────────────────
const TAX_ROWS = [
  // Daily tax processing
  ['BatchW2DataExtraction',         'YEAR=2024,EMPLOYER=EMP001',             'benefits_daily_5am'],
  ['BatchContractorPaymentExport',  'MIN_THRESHOLD=600',                     'benefits_daily_7am'],
  ['BatchTaxWithholdingPost',       '',                                       'benefits_daily_9am'],
  ['BatchPayrollTaxCalc',           'CALC_MODE=SUPPLEMENTAL',                'benefits_daily_12pm'],
  ['BatchStateTaxRemittance',       'STATES=CA,NY,TX,FL',                    'benefits_daily_3pm'],
  ['BatchTaxLiabilityReport',       '',                                       'benefits_daily_5am_withHoliday'],
  ['BatchFederalTaxDeposit',        'DEPOSIT_TYPE=SEMI_WEEKLY',              'benefits_daily_730am'],

  // Weekly tax reconciliation
  ['BatchWithholdingReconcile',     'THRESHOLD_ALERT=500',                   'benefits_weekly_monday_515pm'],
  ['Batch941QuarterlyPrep',         '',                                       'benefits_weekly_friday_4pm'],
  ['BatchTaxFilingStatusCheck',     'INCLUDE_STATES=ALL',                    'benefits_weekly_wednesday_10am'],
  ['BatchGarnishmentTaxCalc',       '',                                       'benefits_weekly_thursday_12pm'],
  ['BatchTaxExemptionAudit',        'AUDIT_YEAR=2024',                       'benefits_weekly_tuesday_5pm'],
  ['BatchLocalTaxReconcile',        'MUNICIPALITIES=ALL',                    'benefits_weekly_saturday_6am'],

  // Monthly tax filings
  ['BatchStateTaxFilingPrep',       'STATES=CA,NY,TX',                       'benefits_monthly_5th_day_9am'],
  ['BatchSUTAFilingBuild',          'STATE=CA,QTR=Q2',                       'benefits_monthly_9th_day_6am'],
  ['BatchFUTALiabilityCalc',        'TAX_YEAR=2024',                         'benefits_monthly_2nd_day'],
  ['BatchW4ProcessingBatch',        '',                                       'benefits_monthly_6th_day_9am'],
  ['BatchTaxAmendmentProcessor',    'AMEND_TYPE=W2C',                        'benefits_monthly_10th_day_6am'],

  // Quarterly / annual
  ['BatchACAReportingBuild',        'YEAR=2024,FORM=1095C',                  'benefits_qtrly_9th_day_530pm'],
  ['BatchW2YearEndBuild',           'TAX_YEAR=2024,FINALIZE=false',          'top_annual_wednesday_12pm'],
  ['Batch1099ContractorBuild',      'TAX_YEAR=2024,MIN_AMT=600',             'xmatch_2nd_thursday_of_1stMonth_of_quarter'],
  ['BatchStateTaxAnnualReconcile',  'STATES=ALL,YEAR=2024',                  'reports_annual_july_1st'],
];

// ── Sheet column definitions ──────────────────────────────────────────────────
const COLUMNS = [
  { header: H_NAME,  key: 'batchName',    width: 42 },
  { header: H_ARGS,  key: 'arguments',    width: 55 },
  { header: H_SCHED, key: 'scheduleName', width: 48 },
];

/**
 * Writes a single sheet into a workbook.
 * @param {ExcelJS.Workbook} wb
 * @param {string} sheetName
 * @param {Array<[string,string,string]>} rows
 */
function addSheet(wb, sheetName, rows) {
  const ws = wb.addWorksheet(sheetName);
  ws.columns = COLUMNS;

  // Bold header row
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' },
  };

  rows.forEach(([batchName, args, scheduleName]) => {
    ws.addRow({ batchName, arguments: args, scheduleName });
  });

  // Auto-filter on header row
  ws.autoFilter = { from: 'A1', to: 'C1' };

  // Freeze top row
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

async function generate() {
  const dataDir = path.resolve(__dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // ── 1. batches.xlsx — combined file the server loads at startup ────────────
  const wbCombined = new ExcelJS.Workbook();
  wbCombined.creator    = 'BatchDashboard';
  wbCombined.lastModifiedBy = 'generateTestData.js';
  wbCombined.created    = new Date();
  wbCombined.modified   = new Date();

  addSheet(wbCombined, 'Benefits',   BENEFITS_ROWS);
  addSheet(wbCombined, 'Tax',        TAX_ROWS);

  const combinedPath = path.join(dataDir, 'batches.xlsx');
  await wbCombined.xlsx.writeFile(combinedPath);
  console.log(`[generateTestData] Written combined file → ${combinedPath}`);
  console.log(`                   Benefits sheet: ${BENEFITS_ROWS.length} rows`);
  console.log(`                   Tax sheet:      ${TAX_ROWS.length} rows`);

  // ── 2. benefits.xlsx — standalone Benefits file for upload testing ─────────
  const wbBenefits = new ExcelJS.Workbook();
  wbBenefits.creator = 'BatchDashboard';
  wbBenefits.created = new Date();
  addSheet(wbBenefits, 'Benefits', BENEFITS_ROWS);
  const benefitsPath = path.join(dataDir, 'benefits.xlsx');
  await wbBenefits.xlsx.writeFile(benefitsPath);
  console.log(`[generateTestData] Written Benefits-only → ${benefitsPath}  (${BENEFITS_ROWS.length} rows)`);

  // ── 3. tax.xlsx — standalone Tax file for upload testing ──────────────────
  const wbTax = new ExcelJS.Workbook();
  wbTax.creator = 'BatchDashboard';
  wbTax.created = new Date();
  addSheet(wbTax, 'Tax', TAX_ROWS);
  const taxPath = path.join(dataDir, 'tax.xlsx');
  await wbTax.xlsx.writeFile(taxPath);
  console.log(`[generateTestData] Written Tax-only     → ${taxPath}  (${TAX_ROWS.length} rows)`);

  console.log('\n[generateTestData] All done.');
  console.log('  → batches.xlsx is the startup file. Restart the server or use Upload Excel in the UI.');
  console.log('  → Upload benefits.xlsx or tax.xlsx via the UI to test hot-reload.');
}

generate().catch((err) => { console.error('[generateTestData] ERROR:', err); process.exit(1); });
