/**
 * currentTasksController.js — handler for GET /api/current-tasks
 *
 * Returns all batches in a sheet (defaults to 'tax') augmented with:
 *   - status:           'active' | 'upcoming' | 'idle' | 'unknown'
 *   - scheduleInfo:     { frequency, description, nextRun (ISO string | null) }
 *
 * Designed to be polled on a 60-second interval from the frontend.
 * Uses server time at the moment of the request — the client should not
 * adjust or interpolate the times.
 */

const excelService  = require('../services/excelService');
const { parseSchedule } = require('../utils/scheduleParser');

/**
 * GET /api/current-tasks?sheet=tax|benefits
 *
 * Returns all rows from the requested sheet, each augmented with
 * parsed schedule timing and a derived status.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
function getCurrentTasks(req, res) {
  const sheet  = (req.query.sheet || 'tax').toLowerCase();
  const batches = excelService.getAll(sheet);
  const now     = new Date(); // capture once — consistent timestamp across all rows

  const augmented = batches.map((batch) => {
    const parsed = parseSchedule(batch.scheduleName, now);
    return {
      ...batch,
      currentTask: {
        status:      parsed.status,        // 'active' | 'upcoming' | 'idle' | 'unknown'
        frequency:   parsed.frequency,
        description: parsed.description,
        nextRun:     parsed.nextRun ? parsed.nextRun.toISOString() : null,
      },
    };
  });

  res.json({
    success:       true,
    sheet,
    count:         augmented.length,
    serverTime:    now.toISOString(),
    data:          augmented,
  });
}

module.exports = { getCurrentTasks };
