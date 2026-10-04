/**
 * columnMapping.config.js
 *
 * Maps Excel column header names → internal model field names.
 *
 * The new Excel file has TWO sheets:
 *   - "Benefits"  (or any sheet whose name contains "benefit", case-insensitive)
 *   - "Tax"       (or any sheet whose name contains "tax", case-insensitive)
 *
 * Each sheet has exactly these three columns:
 *   Batch Name/Job Name            → batchName
 *   Batch Arguments/JVM Arguments  → arguments   (optional; may be empty)
 *   Schedule Name/ Job Group Name  → scheduleName
 *
 * Log directory is derived from sheet source — see SHEET_LOG_PATHS below.
 *
 * To accommodate minor header variations (e.g. trailing spaces, line-break in
 * the image "Schedule Name/ Job Group Name"), the parser normalises headers
 * before matching. The values here should match the normalised form.
 */

/** Column header → internal field name mapping (applies to both sheets) */
const COLUMN_MAP = {
  // Batch Name / Job Name variations
  'Batch Name/Job Name':           'batchName',
  'Batch Name/ Job Name':          'batchName',
  'Batch Name / Job Name':         'batchName',
  'Batch Name /Job Name':          'batchName',
  'Batch Name':                    'batchName',
  'Job Name':                      'batchName',
  'batch_name':                    'batchName',
  'job_name':                      'batchName',
  'BatchName':                     'batchName',
  'JobName':                       'batchName',
  'Batch':                         'batchName',
  'Job':                           'batchName',

  // Arguments variations
  'Batch Arguments/JVM Arguments': 'arguments',
  'Batch Arguments/ JVM Arguments':'arguments',
  'Batch Arguments / JVM Arguments':'arguments',
  'Batch Arguments /JVM Arguments':'arguments',
  'Batch Arguments':               'arguments',
  'JVM Arguments':                 'arguments',
  'JVM Args':                      'arguments',
  'Batch Args':                    'arguments',
  'Arguments':                     'arguments',
  'Args':                          'arguments',
  'batch_arguments':               'arguments',
  'jvm_arguments':                 'arguments',
  'batch_args':                    'arguments',
  'jvm_args':                      'arguments',
  'BatchArguments':                'arguments',
  'JVMArguments':                  'arguments',

  // Schedule Name / Job Group Name variations
  'Schedule Name/ Job Group Name': 'scheduleName',
  'Schedule Name/Job Group Name':  'scheduleName',
  'Schedule Name / Job Group Name':'scheduleName',
  'Schedule Name /Job Group Name': 'scheduleName',
  'Schedule Name':                 'scheduleName',
  'Job Group Name':                'scheduleName',
  'Job Group':                     'scheduleName',
  'JobGroup':                      'scheduleName',
  'Schedule':                      'scheduleName',
  'ScheduleName':                  'scheduleName',
  'JobGroupName':                  'scheduleName',
  'schedule_name':                 'scheduleName',
  'job_group_name':                'scheduleName',
  'job_group':                     'scheduleName',
  'Group Name':                    'scheduleName',
  'Group':                         'scheduleName',

  // Trigger Needed variations
  'Trigger Needed':                'triggerNeeded',
  'Trigger Needed?':               'triggerNeeded',
  'Trigger':                       'triggerNeeded',
  'Trigger?':                      'triggerNeeded',
  'TriggerNeeded':                 'triggerNeeded',
  'trigger_needed':                'triggerNeeded',
  'trigger':                       'triggerNeeded',
};

/**
 * Log/bin directory path per sheet source.
 * Key must be the lowercase normalised sheet source tag set by fileParser.
 */
const SHEET_LOG_PATHS = {
  benefits: 'cd /opt/app/accessms/bin/benefits/batch',
  tax:      'cd /opt/app/accessms/bin/tax/batch/',
};

module.exports = { COLUMN_MAP, SHEET_LOG_PATHS };
