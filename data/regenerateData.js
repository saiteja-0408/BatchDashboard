/**
 * regenerateData.js — regenerates benefits.xlsx, tax.xlsx, and batches.xlsx
 * with the exact schema the app expects, now including the "Trigger Needed" column.
 *
 * Columns (D1 = column 4):
 *   A: Batch Name/Job Name
 *   B: Batch Arguments/JVM Arguments
 *   C: Schedule Name/ Job Group Name
 *   D: Trigger Needed
 *
 * Run: node data/regenerateData.js
 */

'use strict';

const ExcelJS = require('exceljs');
const path    = require('path');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
const HEADER_FONT = { bold: true };

const BENEFITS_ROWS = [
  ['BatchEnrollmentSync',        'ENV=PROD,TENANT=benefits',          'benefits_daily_6am',               'Y'],
  ['BatchEligibilityLoad',       '',                                  'benefits_daily_8am',               'N'],
  ['BatchDependentVerification', 'REPORT_TYPE=FULL',                  'benefits_daily_930am',             'Y'],
  ['BatchLifeEventProcessor',    '',                                  'benefits_daily_4pm',               'N'],
  ['BatchCoverageChangeNotifier','NOTIFY=EMAIL,SMS',                  'benefits_daily_515pm',             'Y'],
  ['BatchBeneficiaryUpdate',     '',                                  'benefits_daily_9pm',               'N'],
  ['BatchPremiumCalculation',    'CALC_MODE=STANDARD',               'benefits_daily_1030am',            'Y'],
  ['BatchHSAContributionPost',   '',                                  'benefits_daily_0630pm',            'N'],
  ['BatchWeeklyEnrollmentReport','FORMAT=PDF,RECIPIENT=hr-team@corp.com','benefits_weekly_friday_6am',   'Y'],
  ['BatchCobraEligibilityCheck', '',                                  'benefits_weekly_monday_6am',       'N'],
  ['BatchDentalClaimsReconcile', 'PLAN_YEAR=2024',                   'benefits_weekly_wednesday_6am',    'Y'],
  ['BatchVisionBenefitsAudit',   '',                                  'benefits_weekly_thursday_9am',     'N'],
  ['BatchWellnessIncentiveCalc', 'PROGRAM=WELLNESS2024',              'benefits_weekly_tuesday_6am',      'Y'],
  ['BatchFSABalanceReconcile',   'TAX_YEAR=2024',                    'benefits_monthly_1st_day_6am',     'Y'],
  ['BatchHRAMonthlyStatement',   '',                                  'benefits_monthly_3rd_day_6am',     'N'],
  ['BatchOpenEnrollmentSummary', 'OE_YEAR=2024,FINALIZE=true',       'benefits_monthly_8th_day_6am',     'Y'],
  ['BatchDependentAuditReport',  'INCLUDE_INACTIVE=false',           'benefits_monthly_15th_day_6am',    'N'],
  ['BatchBenefitsCostAnalysis',  '',                                  'benefits_monthly_last_day_7pm',    'Y'],
  ['BatchQtrlyBenefitsSummary',  'QUARTER=Q2_2024',                  'benefits_qtrly_1st_day',           'Y'],
  ['BatchACAEligibilityBuild',   'YEAR=2024,EMPLOYER_ID=EMP001',     'benefits_qtrly_9th_day',           'N'],
  ['BatchOpenEnrollmentEligLoad','FILE=/data/elig/oe2024.csv',        'on_demand',                        'Y'],
  ['BatchBenefitsIconExport',    'EXPORT_TYPE=FULL',                  'benefits_icon_export_10am',        'N'],
];

const TAX_ROWS = [
  ['BatchW2DataExtraction',       'YEAR=2024,EMPLOYER=EMP001',        'benefits_daily_5am',               'Y'],
  ['BatchContractorPaymentExport','MIN_THRESHOLD=600',                'benefits_daily_7am',               'N'],
  ['BatchTaxWithholdingPost',     '',                                  'benefits_daily_9am',               'Y'],
  ['BatchPayrollTaxCalc',         'CALC_MODE=SUPPLEMENTAL',           'benefits_daily_12pm',              'Y'],
  ['BatchStateTaxRemittance',     'STATES=CA,NY,TX,FL',               'benefits_daily_3pm',               'N'],
  ['BatchTaxLiabilityReport',     '',                                  'benefits_daily_5am_withHoliday',   'Y'],
  ['BatchFederalTaxDeposit',      'DEPOSIT_TYPE=SEMI_WEEKLY',         'benefits_daily_730am',             'Y'],
  ['BatchWithholdingReconcile',   'THRESHOLD_ALERT=500',              'benefits_weekly_monday_515pm',     'N'],
  ['Batch941QuarterlyPrep',       '',                                  'benefits_weekly_friday_4pm',       'N'],
  ['BatchTaxFilingStatusCheck',   'INCLUDE_STATES=ALL',               'benefits_weekly_wednesday_10am',   'Y'],
  ['BatchGarnishmentTaxCalc',     '',                                  'benefits_weekly_thursday_12pm',    'N'],
  ['BatchTaxExemptionAudit',      'AUDIT_YEAR=2024',                  'benefits_weekly_tuesday_5pm',      'Y'],
  ['BatchLocalTaxReconcile',      'MUNICIPALITIES=ALL',               'benefits_weekly_saturday_6am',     'N'],
  ['BatchStateTaxFilingPrep',     'STATES=CA,NY,TX',                  'benefits_monthly_5th_day_9am',     'Y'],
  ['BatchSUTAFilingBuild',        'STATE=CA,QTR=Q2',                  'benefits_monthly_9th_day_6am',     'Y'],
  ['BatchFUTALiabilityCalc',      'TAX_YEAR=2024',                    'benefits_monthly_2nd_day',         'N'],
  ['BatchW4ProcessingBatch',      '',                                  'benefits_monthly_6th_day_9am',     'Y'],
  ['BatchTaxAmendmentProcessor',  'AMEND_TYPE=W2C',                   'benefits_monthly_10th_day_6am',    'N'],
  ['BatchACAReportingBuild',      'YEAR=2024,FORM=1095C',             'benefits_qtrly_9th_day_530pm',     'Y'],
  ['BatchW2YearEndBuild',         'TAX_YEAR=2024,FINALIZE=false',     'top_annual_wednesday_12pm',        'Y'],
  ['Batch1099ContractorBuild',    'TAX_YEAR=2024,MIN_AMT=600',        'xmatch_2nd_thursday_of_1stMonth_of_quarter', 'N'],
  ['BatchStateTaxAnnualReconcile','STATES=ALL,YEAR=2024',             'reports_annual_july_1st',          'Y'],
];

const HEADERS = [
  'Batch Name/Job Name',
  'Batch Arguments/JVM Arguments',
  'Schedule Name/ Job Group Name',
  'Trigger Needed',
];

/**
 * Writes a single sheet into the given workbook.
 * @param {ExcelJS.Workbook} wb
 * @param {string} sheetName - 'Benefits' or 'Tax'
 * @param {string[][]} rows  - data rows (no header)
 */
function writeSheet(wb, sheetName, rows) {
  const ws = wb.addWorksheet(sheetName);

  // Header row
  const headerRow = ws.addRow(HEADERS);
  headerRow.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
  });

  // Column widths
  ws.getColumn(1).width = 36;
  ws.getColumn(2).width = 40;
  ws.getColumn(3).width = 42;
  ws.getColumn(4).width = 16;

  // Data rows
  rows.forEach((row) => ws.addRow(row));
}

async function main() {
  // ── benefits.xlsx (single Benefits sheet) ────────────────────────────────
  const wbBenefits = new ExcelJS.Workbook();
  writeSheet(wbBenefits, 'Benefits', BENEFITS_ROWS);
  await wbBenefits.xlsx.writeFile(path.join(__dirname, 'benefits.xlsx'));
  console.log('[regenerate] benefits.xlsx written');

  // ── tax.xlsx (single Tax sheet) ───────────────────────────────────────────
  const wbTax = new ExcelJS.Workbook();
  writeSheet(wbTax, 'Tax', TAX_ROWS);
  await wbTax.xlsx.writeFile(path.join(__dirname, 'tax.xlsx'));
  console.log('[regenerate] tax.xlsx written');

  // ── batches.xlsx (both sheets — used as test fixture) ─────────────────────
  const wbBatches = new ExcelJS.Workbook();
  writeSheet(wbBatches, 'Benefits', BENEFITS_ROWS);
  writeSheet(wbBatches, 'Tax', TAX_ROWS);
  await wbBatches.xlsx.writeFile(path.join(__dirname, 'batches.xlsx'));
  console.log('[regenerate] batches.xlsx written');
}

main().catch((err) => { console.error(err); process.exit(1); });
