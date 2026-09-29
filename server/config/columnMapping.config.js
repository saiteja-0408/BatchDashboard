/**
 * columnMapping.config.js
 *
 * Maps Excel column header names → internal model field names.
 * Change the VALUES (left side of colon) to match your actual Excel headers
 * without touching any other source code.
 *
 * Example: if your Excel uses "BatchID" instead of "Batch_ID",
 * change: Batch_ID: 'batchId'  →  BatchID: 'batchId'
 */

module.exports = {
  // Excel column header  : internal model field name
  Batch_ID:               'batchId',
  Batch_Name:             'batchName',
  Description:            'description',
  Domain:                 'domain',
  Frequency:              'frequency',
  Schedule_Time:          'scheduleTime',
  Last_Run_Time:          'lastRunTime',
  Next_Run_Time:          'nextRunTime',
  Last_Run_Status:        'lastRunStatus',
  Environment:            'environment',
  Owner_Team:             'ownerTeam',
  Start_Command:          'startCommand',
  Stop_Command:           'stopCommand',
  Status_Command:         'statusCommand',
  Log_Path:               'logPath',
  Config_Path:            'configPath',
  Notes:                  'notes',
};
