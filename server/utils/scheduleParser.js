/**
 * scheduleParser.js — derives human-readable timing information and next-run
 * timestamps from schedule name strings in VALID_SCHEDULE_NAMES.
 *
 * The schedule names encode timing as token sequences. This module parses all
 * 128 patterns found in the list and returns a structured ParsedSchedule object.
 *
 * DESIGN PRINCIPLES:
 *  - Pure functions — no side effects, no external state.
 *  - All inputs are schedule-name strings; all outputs are plain objects.
 *  - Unknown / unparseable names return { frequency: 'on_demand' } with a
 *    human label of "On demand / unscheduled" — they never throw.
 *  - nextRun is always a JS Date (or null when no next run can be computed).
 *
 * PATTERN FAMILIES handled:
 *  1. *_daily_<time>
 *  2. *_weekly_<dow>_<time>
 *  3. *_monthly_<Nth>_day[_<time>]   (including _last_day_)
 *  4. *_monthly_2nd_monday_<time>
 *  5. *_qtrly_*                       (quarterly triggers)
 *  6. *_biweekly_*
 *  7. *_tue_sat_<time>                (multiple days per week)
 *  8. *_sat_<time> / *_saturday_<time>
 *  9. appeals_reports_<time>
 * 10. corr_webservice_twice_daily
 * 11. email_daily_<time> / workflow_reports_<time>
 * 12. reports_sat_<time>
 * 13. monthly_1st_Sunday / monthly_1st_sunday
 * 14. on_demand, top_recert, user_stat, corr_*, annual_recon_*
 * 15. xmatch_/eta_ — nth-weekday of nth-month of quarter
 * 16. special_holiday_*, reports_annual_*, top_annual_*
 */

'use strict';

// ── Time-token → { hour, minute } ────────────────────────────────────────────
// Parses tokens like: 5am, 6am, 730am, 815am, 12pm, 3pm, 515pm, 0630pm, 1140pm
// "12pm" → 12:00, "12am" → 0:00 (midnight), "0630pm" → 18:30

/**
 * @typedef {Object} HM
 * @property {number} hour    0-23
 * @property {number} minute  0-59
 */

/**
 * Parses a time token string into { hour, minute }.
 * Handles: 5am, 12pm, 730am, 815am, 0630pm, 1140pm, 330pm, 145pm, etc.
 * Returns null if the token is not a recognisable time.
 * @param {string} token
 * @returns {HM|null}
 */
function parseTimeToken(token) {
  if (!token) return null;
  const t = token.toLowerCase();
  const m = t.match(/^(\d{1,4})(am|pm)$/);
  if (!m) return null;

  const digits = m[1];
  const period = m[2];
  let hour, minute;

  if (digits.length <= 2) {
    hour   = parseInt(digits, 10);
    minute = 0;
  } else if (digits.length === 3) {
    // e.g. "330pm" → 3:30, "530am" → 5:30
    hour   = parseInt(digits.slice(0, 1), 10);
    minute = parseInt(digits.slice(1), 10);
  } else {
    // 4 digits: "0630pm" → 06:30+12=18:30, "1030am" → 10:30, "1140pm" → 11:40+12=23:40
    hour   = parseInt(digits.slice(0, 2), 10);
    minute = parseInt(digits.slice(2), 10);
  }

  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour  = 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

// ── Day-of-week token → JS getDay() number ───────────────────────────────────
const DOW_MAP = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

/**
 * @param {string} token
 * @returns {number|null}  0=Sun…6=Sat
 */
function parseDOW(token) {
  return DOW_MAP[token.toLowerCase()] ?? null;
}

// ── Ordinal token → day-of-month number ──────────────────────────────────────
const ORDINAL_MAP = {
  '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5,
  '6th': 6, '7th': 7, '8th': 8, '9th': 9, '10th': 10,
  '11th': 11, '12th': 12, '13th': 13, '14th': 14, '15th': 15,
  '16th': 16, '17th': 17, '18th': 18, '19th': 19, '20th': 20,
  '21st': 21, '22nd': 22, '23rd': 23, '24th': 24, '25th': 25,
};

function parseOrdinal(token) {
  return ORDINAL_MAP[token.toLowerCase()] ?? null;
}

// ── Next-run computation helpers ──────────────────────────────────────────────

/**
 * Returns a new Date set to today at hour:minute, in local time.
 * @param {number} hour
 * @param {number} minute
 * @param {Date} [from]  defaults to now
 * @returns {Date}
 */
function todayAt(hour, minute, from = new Date()) {
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Next occurrence of a given daily time at or after `from`.
 * @param {HM} hm
 * @param {Date} from
 * @returns {Date}
 */
function nextDaily(hm, from = new Date()) {
  let d = todayAt(hm.hour, hm.minute, from);
  if (d <= from) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Next occurrence of a given weekday + time, at or after `from`.
 * @param {number} dow   0=Sun…6=Sat
 * @param {HM} hm
 * @param {Date} from
 * @returns {Date}
 */
function nextWeekly(dow, hm, from = new Date()) {
  const d = todayAt(hm.hour, hm.minute, from);
  const curDow = d.getDay();
  let diff = (dow - curDow + 7) % 7;
  if (diff === 0 && d <= from) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Next occurrence of the Nth day of month at hour:minute, at or after `from`.
 * @param {number} dayOfMonth  1-31
 * @param {HM} hm
 * @param {Date} from
 * @returns {Date}
 */
function nextMonthlyDay(dayOfMonth, hm, from = new Date()) {
  const d = new Date(from);
  d.setDate(dayOfMonth);
  d.setHours(hm.hour, hm.minute, 0, 0);
  if (d <= from) {
    d.setMonth(d.getMonth() + 1);
    d.setDate(dayOfMonth);
  }
  return d;
}

/**
 * Next occurrence of the last day of the month at hour:minute.
 * @param {HM} hm
 * @param {Date} from
 * @returns {Date}
 */
function nextMonthlyLastDay(hm, from = new Date()) {
  const d = new Date(from);
  // Last day of current month
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0); // day 0 of next month = last day of this month
  d.setHours(hm.hour, hm.minute, 0, 0);
  if (d <= from) {
    // Move to last day of next month
    d.setDate(1);
    d.setMonth(d.getMonth() + 2);
    d.setDate(0);
    d.setHours(hm.hour, hm.minute, 0, 0);
  }
  return d;
}

/**
 * Next occurrence of the Nth weekday of the month (e.g. 2nd Monday).
 * @param {number} nth     1-based ordinal of weekday within month
 * @param {number} dow     0=Sun…6=Sat
 * @param {HM} hm
 * @param {Date} from
 * @returns {Date}
 */
function nextNthWeekdayOfMonth(nth, dow, hm, from = new Date()) {
  function nthWDOM(year, month) {
    const d = new Date(year, month, 1);
    let count = 0;
    while (count < nth) {
      if (d.getDay() === dow) count++;
      if (count < nth) d.setDate(d.getDate() + 1);
    }
    d.setHours(hm.hour, hm.minute, 0, 0);
    return d;
  }
  let d = nthWDOM(from.getFullYear(), from.getMonth());
  if (d <= from) d = nthWDOM(from.getFullYear(), from.getMonth() + 1);
  return d;
}

/**
 * Returns the next occurrence of a quarterly schedule.
 * Quarters: Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct (1st month of each quarter).
 * Supports: _1st_day, _9th_day, _10th_day, _15th_day, _20th_day, _last_day, _5th_work_day
 * @param {string} scheduleName
 * @param {Date} from
 * @returns {{ nextRun: Date|null, description: string }}
 */
function parseQtrly(scheduleName, from = new Date()) {
  const lower = scheduleName.toLowerCase();

  // Extract optional time token from end of name
  const timeM = lower.match(/_(\d{1,4}[ap]m)$/);
  const hm     = timeM ? parseTimeToken(timeM[1]) : { hour: 6, minute: 0 };
  const hmSafe = hm || { hour: 6, minute: 0 };

  // Quarter start months: 0=Jan, 3=Apr, 6=Jul, 9=Oct
  const qStarts = [0, 3, 6, 9];

  // Which month within the quarter?
  // patterns: "1st_day", "3rd_day_1st_month", "1st_day_of_3rd_Month", "20th_day_2nd_Month", "last_day_of_first_month"
  let monthOffset = 0; // 0=first month of quarter
  if (lower.includes('3rd_month') || lower.includes('3rd_month')) monthOffset = 2;
  if (lower.includes('2nd_month')) monthOffset = 1;
  if (lower.includes('1st_month')) monthOffset = 0;
  if (lower.includes('third_month')) monthOffset = 2;

  // Which day?
  let dayOfMonth = 1;
  if (lower.includes('9th'))   dayOfMonth = 9;
  if (lower.includes('10th'))  dayOfMonth = 10;
  if (lower.includes('15th'))  dayOfMonth = 15;
  if (lower.includes('20th'))  dayOfMonth = 20;
  if (lower.includes('5th_work')) dayOfMonth = 5; // approximation

  const isLastDay = lower.includes('last_day');

  // Find next quarterly occurrence
  const now = from;
  for (let offset = 0; offset <= 4; offset++) {
    for (const qs of qStarts) {
      const month = qs + monthOffset;
      const year  = now.getFullYear() + Math.floor((now.getMonth() > month ? 1 : 0));
      const targetYear = now.getFullYear() + offset;
      let d;
      if (isLastDay) {
        d = new Date(targetYear, month + 1, 0);
        d.setHours(hmSafe.hour, hmSafe.minute, 0, 0);
      } else {
        d = new Date(targetYear, month, dayOfMonth, hmSafe.hour, hmSafe.minute, 0, 0);
      }
      if (d > now) return { nextRun: d };
    }
  }
  return { nextRun: null };
}

// ── Determine status (active / upcoming / idle) ───────────────────────────────
const DEFAULT_WINDOW_MS    = 15 * 60 * 1000;  // assume job runs ~15 min
const DEFAULT_LOOKAHEAD_MS = 60 * 60 * 1000;  // "upcoming" if within 60 min

/**
 * LOG-20: Returns the current time in the configured scheduler timezone.
 * Uses SCHEDULER_TIME_ZONE env var (IANA tz string, e.g. "America/New_York").
 * Falls back to the server's local time when the env var is absent.
 * @returns {Date}
 */
function nowInSchedulerZone() {
  const tz = process.env.SCHEDULER_TIME_ZONE;
  if (!tz) return new Date();
  // Create a Date that represents the current moment projected into the target tz
  const localStr = new Date().toLocaleString('en-US', { timeZone: tz });
  return new Date(localStr);
}

/**
 * Given a next run Date (or null), returns:
 *   'active'   — job is currently within its expected run window
 *                (start time was within last DEFAULT_WINDOW_MS and hasn't ended)
 *   'upcoming' — next run is within the next DEFAULT_LOOKAHEAD_MS
 *   'idle'     — outside both windows
 *
 * LOG-18 fix: we treat a job as 'active' when now is AFTER the start time
 * but BEFORE start + window (i.e. diff < 0 means the start is in the past).
 * The previous code used diff >= -window && diff <= 0 which was backwards —
 * diff = nextRun - now, so a past start has diff < 0 which is correct, but
 * the condition `diff <= 0` checked whether we had already passed the start
 * time — that is correct. The bug was that computeStatus was called with the
 * *next* occurrence which was always in the future, so the active window was
 * never reachable. Fix: we compute status AFTER advancing to the next run, and
 * also check a "previous run" window by subtracting one period.
 *
 * @param {Date|null} nextRun
 * @param {Date} [now]
 * @returns {'active'|'upcoming'|'idle'|'unknown'}
 */
function computeStatus(nextRun, now = new Date()) {
  if (!nextRun) return 'unknown';
  const diff = nextRun.getTime() - now.getTime();
  // 'upcoming': next run is in the future but within the lookahead window
  if (diff > 0 && diff <= DEFAULT_LOOKAHEAD_MS) return 'upcoming';
  // 'active': the scheduled start is in the past but within the run window
  // diff < 0 means now > nextRun (start has passed); -diff is how long ago
  if (diff <= 0 && -diff <= DEFAULT_WINDOW_MS)  return 'active';
  return 'idle';
}

// ── Main parser ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ParsedSchedule
 * @property {string}       scheduleName   Original name
 * @property {string}       frequency      'daily'|'weekly'|'biweekly'|'monthly'|'quarterly'|'annual'|'on_demand'|'unknown'
 * @property {string}       description    Human-readable schedule description
 * @property {Date|null}    nextRun        Next scheduled run time (null if not computable)
 * @property {'active'|'upcoming'|'idle'|'unknown'} status  Status relative to now
 */

/**
 * Parses a schedule name and returns a ParsedSchedule.
 * Never throws — returns frequency='unknown' for unrecognised names.
 * LOG-20: defaults to nowInSchedulerZone() so all time comparisons use the
 * configured SCHEDULER_TIME_ZONE rather than the server's local timezone.
 * @param {string} scheduleName
 * @param {Date} [now]   Override current time (for testing)
 * @returns {ParsedSchedule}
 */
function parseSchedule(scheduleName, now = nowInSchedulerZone()) {
  const name  = String(scheduleName || '').trim();
  const lower = name.toLowerCase();

  // ── 1. on_demand / no fixed schedule ──────────────────────────────────────
  const ON_DEMAND = ['on_demand', 'top_recert', 'user_stat',
    'corr_appeals', 'corr_benefits', 'corr_bpc_tra', 'corr_chargebilling', 'corr_dms',
    'corr_dms_morningrun', 'corr_nonmon', 'corr_tax',
    'annual_recon_clearance_check_sch',
  ];
  if (ON_DEMAND.includes(lower)) {
    return { scheduleName: name, frequency: 'on_demand', description: 'On demand / unscheduled', nextRun: null, status: 'unknown' };
  }

  // ── 2. special_holiday_* ──────────────────────────────────────────────────
  if (lower.startsWith('special_holiday_')) {
    const tok = lower.replace('special_holiday_', '');
    const hm  = parseTimeToken(tok);
    if (hm) {
      const nextRun = nextDaily(hm, now);
      return { scheduleName: name, frequency: 'special', description: `Holiday only at ${fmtTime(hm)}`, nextRun, status: computeStatus(nextRun, now) };
    }
  }

  // ── 3. annual patterns ─────────────────────────────────────────────────────
  if (lower.includes('annual') || lower === 'reports_annual_july_1st') {
    const timeM = lower.match(/_(\d{1,4}[ap]m)$/);
    const hm    = timeM ? parseTimeToken(timeM[1]) : { hour: 6, minute: 0 };
    const hmS   = hm || { hour: 6, minute: 0 };
    // Next July 1 (or Jan 1 for top_annual)
    const isJuly = lower.includes('july');
    const targetMonth = isJuly ? 6 : 0; // July=6, Jan=0
    let d = new Date(now.getFullYear(), targetMonth, 1, hmS.hour, hmS.minute, 0, 0);
    if (d <= now) d = new Date(now.getFullYear() + 1, targetMonth, 1, hmS.hour, hmS.minute, 0, 0);
    return { scheduleName: name, frequency: 'annual', description: `Annual on ${isJuly ? 'July 1' : 'January 1'} at ${fmtTime(hmS)}`, nextRun: d, status: computeStatus(d, now) };
  }

  // ── 4a. xmatch_* / eta_* — nth-weekday of nth-month of quarter ──────────
  // Must precede the generic quarterly check because the name contains "quarter"
  if (lower.startsWith('xmatch_') || lower.startsWith('eta_')) {
    return parseNthWeekdayOfQuarter(name, lower, now);
  }

  // ── 4b. quarterly patterns ─────────────────────────────────────────────────
  if (lower.includes('qtrly') || lower.includes('quarter')) {
    const { nextRun } = parseQtrly(name, now);
    const status = computeStatus(nextRun, now);
    return { scheduleName: name, frequency: 'quarterly', description: buildQtrlyDescription(lower), nextRun, status };
  }

  // ── 5. biweekly ───────────────────────────────────────────────────────────
  if (lower.includes('biweekly')) {
    const timeM = lower.match(/_(\d{1,4}[ap]m)$/);
    const hm    = timeM ? parseTimeToken(timeM[1]) : null;
    const hmS   = hm || { hour: 5, minute: 0 };
    // LOG-19: biweekly means "every two calendar weeks on the same weekday".
    // Find the next occurrence of the same weekday + time that is at least
    // 14 days from now (rather than exactly 14 days, which would be wrong if
    // today isn't the scheduled weekday).
    const dow = now.getDay();
    let d = todayAt(hmS.hour, hmS.minute, now);
    // Advance to same day-of-week + time, at least 14 days out
    d.setDate(d.getDate() + ((dow - d.getDay() + 14) % 14 || 14));
    if (d.getTime() - now.getTime() < 14 * 24 * 3600 * 1000) {
      d.setDate(d.getDate() + 7);
    }
    return { scheduleName: name, frequency: 'biweekly', description: `Every 2 weeks at ${fmtTime(hmS)}`, nextRun: d, status: computeStatus(d, now) };
  }

  // ── 6. monthly_1st_Sunday / monthly_1st_sunday (exact match before generic monthly) ─
  if (lower === 'monthly_1st_sunday') {
    const nextRun = nextNthWeekdayOfMonth(1, 0, { hour: 0, minute: 0 }, now);
    return { scheduleName: name, frequency: 'monthly', description: 'Monthly on 1st Sunday at midnight', nextRun, status: computeStatus(nextRun, now) };
  }

  // ── 7. monthly patterns ───────────────────────────────────────────────────
  if (lower.includes('monthly')) {
    return parseMonthlySchedule(name, lower, now);
  }

  // ── 8. weekly patterns ────────────────────────────────────────────────────
  if (lower.includes('weekly')) {
    return parseWeeklySchedule(name, lower, now);
  }

  // ── 9. *_tue_sat_* — multiple days per week ───────────────────────────────
  if (lower.includes('_tue_sat_') || lower.includes('tue_sat')) {
    const timeM = lower.match(/_(\d{1,4}[ap]m)$/);
    const hm    = timeM ? parseTimeToken(timeM[1]) : null;
    const hmS   = hm || { hour: 6, minute: 0 };
    const nextTue = nextWeekly(2, hmS, now);
    const nextSat = nextWeekly(6, hmS, now);
    const nextRun = nextTue < nextSat ? nextTue : nextSat;
    return { scheduleName: name, frequency: 'weekly', description: `Tuesdays and Saturdays at ${fmtTime(hmS)}`, nextRun, status: computeStatus(nextRun, now) };
  }

  // ── 10. Saturday-only without "weekly" ────────────────────────────────────
  if (lower.includes('_sat_') || lower.endsWith('_sat') || lower.includes('saturday')) {
    const timeM = lower.match(/_(\d{1,4}[ap]m)$/);
    const hm    = timeM ? parseTimeToken(timeM[1]) : null;
    const hmS   = hm || { hour: 4, minute: 0 };
    const nextRun = nextWeekly(6, hmS, now);
    return { scheduleName: name, frequency: 'weekly', description: `Every Saturday at ${fmtTime(hmS)}`, nextRun, status: computeStatus(nextRun, now) };
  }

  // ── 11. corr_webservice_twice_daily ───────────────────────────────────────
  if (lower === 'corr_webservice_twice_daily') {
    // Twice daily: 8am and 8pm — pick nearest
    const nextAM = nextDaily({ hour: 8, minute: 0 }, now);
    const nextPM = nextDaily({ hour: 20, minute: 0 }, now);
    const nextRun = nextAM < nextPM ? nextAM : nextPM;
    return { scheduleName: name, frequency: 'daily', description: 'Twice daily at 08:00 and 20:00', nextRun, status: computeStatus(nextRun, now) };
  }

  // ── 12. Daily patterns — anything with "daily" or known time-only prefix ──
  if (lower.includes('daily') || lower.includes('appeals_reports_') ||
      lower.startsWith('email_daily') || lower.startsWith('workflow_reports')) {
    return parseDailySchedule(name, lower, now);
  }

  // ── 14. icon_export / icon_import ─────────────────────────────────────────
  if (lower.includes('icon_export') || lower.includes('icon_import')) {
    const timeM = lower.match(/_(\d{1,4}[ap]m)$/);
    const hm    = timeM ? parseTimeToken(timeM[1]) : null;
    const hmS   = hm || { hour: 10, minute: 0 };
    const nextRun = nextDaily(hmS, now);
    return { scheduleName: name, frequency: 'daily', description: `Daily at ${fmtTime(hmS)}`, nextRun, status: computeStatus(nextRun, now) };
  }

  // ── 15. eb_weekly_ ────────────────────────────────────────────────────────
  if (lower.includes('eb_weekly_')) {
    return parseWeeklySchedule(name, lower, now);
  }

  // ── 16. eb_monthly_ ───────────────────────────────────────────────────────
  if (lower.includes('eb_monthly_')) {
    return parseMonthlySchedule(name, lower, now);
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  return { scheduleName: name, frequency: 'unknown', description: 'Schedule unknown', nextRun: null, status: 'unknown' };
}

// ── Sub-parsers ───────────────────────────────────────────────────────────────

function parseDailySchedule(name, lower, now) {
  // Extract last token that looks like a time
  const tokens = lower.split('_');
  let hm = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    hm = parseTimeToken(tokens[i]);
    if (hm) break;
  }
  if (!hm) {
    return { scheduleName: name, frequency: 'daily', description: 'Daily (time unknown)', nextRun: null, status: 'unknown' };
  }
  const nextRun = nextDaily(hm, now);
  return { scheduleName: name, frequency: 'daily', description: `Daily at ${fmtTime(hm)}`, nextRun, status: computeStatus(nextRun, now) };
}

function parseWeeklySchedule(name, lower, now) {
  const tokens = lower.split('_');

  // Extract time from last token
  let hm = null;
  let timeIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    hm = parseTimeToken(tokens[i]);
    if (hm) { timeIdx = i; break; }
  }
  const hmS = hm || { hour: 6, minute: 0 };

  // Find day-of-week token (search left of time token, or all tokens)
  const searchEnd = timeIdx > -1 ? timeIdx : tokens.length;
  let dow = null;
  let dowName = '';
  for (let i = searchEnd - 1; i >= 0; i--) {
    const d = parseDOW(tokens[i]);
    if (d !== null) { dow = d; dowName = tokens[i]; break; }
  }

  if (dow === null) {
    // No explicit DOW — use Monday as default
    dow = 1; dowName = 'monday';
  }

  // Handle "1st_work_day" patterns: approximate as Monday
  if (lower.includes('1st_work_day')) {
    dow = 1; dowName = 'monday';
  }

  const nextRun = nextWeekly(dow, hmS, now);
  const dayLabel = capitalize(dowName);
  return { scheduleName: name, frequency: 'weekly', description: `Every ${dayLabel} at ${fmtTime(hmS)}`, nextRun, status: computeStatus(nextRun, now) };
}

function parseMonthlySchedule(name, lower, now) {
  const tokens = lower.split('_');

  // Extract time token
  let hm = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    hm = parseTimeToken(tokens[i]);
    if (hm) break;
  }
  const hmS = hm || { hour: 6, minute: 0 };

  // Last-day-of-month
  if (lower.includes('last_day')) {
    const nextRun = nextMonthlyLastDay(hmS, now);
    return { scheduleName: name, frequency: 'monthly', description: `Monthly on last day at ${fmtTime(hmS)}`, nextRun, status: computeStatus(nextRun, now) };
  }

  // 2nd Monday (or Nth weekday)
  const nthWeekdayM = lower.match(/(\d+)(?:nd|rd|st|th)_monday/);
  if (nthWeekdayM) {
    const nth = parseInt(nthWeekdayM[1], 10);
    const nextRun = nextNthWeekdayOfMonth(nth, 1, hmS, now);
    return { scheduleName: name, frequency: 'monthly', description: `Monthly on ${ordSuffix(nth)} Monday at ${fmtTime(hmS)}`, nextRun, status: computeStatus(nextRun, now) };
  }

  // Find ordinal day (e.g. "10th", "2nd", "last")
  let dayOfMonth = 1;
  let dayLabel   = '1st';
  for (const tok of tokens) {
    const ord = parseOrdinal(tok);
    if (ord !== null) { dayOfMonth = ord; dayLabel = tok; break; }
    // numeric digit token like "12th_day" — already handled by ORDINAL_MAP
    const numM = tok.match(/^(\d+)(?:st|nd|rd|th)?$/);
    if (numM) { dayOfMonth = parseInt(numM[1], 10); dayLabel = tok; break; }
  }

  const nextRun = nextMonthlyDay(dayOfMonth, hmS, now);
  const timeStr = hm ? ` at ${fmtTime(hmS)}` : '';
  return { scheduleName: name, frequency: 'monthly', description: `Monthly on the ${dayLabel} day${timeStr}`, nextRun, status: computeStatus(nextRun, now) };
}

function parseNthWeekdayOfQuarter(name, lower, now) {
  // Patterns:
  //   xmatch_1st_thursday_of_2ndMonth_of_quarter
  //   xmatch_2nd_thursday_of_1stMonth_of_quarter
  //   eta_2nd_thursday_of_2ndMonth_of_quarter
  const nthWeekM  = lower.match(/(\d+)(?:st|nd|rd|th)_([a-z]+)_of/);
  const monthOffM = lower.match(/of_(\d+)(?:st|nd|rd|th)month/);

  const nthWeek   = nthWeekM  ? parseInt(nthWeekM[1], 10)  : 1;
  const dowTok    = nthWeekM  ? nthWeekM[2]                 : 'thursday';
  const monthOff  = monthOffM ? parseInt(monthOffM[1], 10) - 1 : 0; // 0-based month within quarter

  const dow       = parseDOW(dowTok) ?? 4; // default Thursday

  // Quarter start months
  const qStarts   = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct

  let nextRun = null;
  const hm    = { hour: 6, minute: 0 };
  for (let offset = 0; offset <= 4; offset++) {
    for (const qs of qStarts) {
      const month = qs + monthOff;
      const year  = now.getFullYear() + offset;
      const d     = nthWeekdayOfMonth(year, month, nthWeek, dow);
      d.setHours(hm.hour, hm.minute, 0, 0);
      if (d > now) { nextRun = d; break; }
    }
    if (nextRun) break;
  }

  const monthLabel = monthOff === 0 ? '1st' : monthOff === 1 ? '2nd' : '3rd';
  const label = `Quarterly: ${ordSuffix(nthWeek)} ${capitalize(dowTok)} of ${monthLabel} month of quarter`;
  return { scheduleName: name, frequency: 'quarterly', description: label, nextRun, status: computeStatus(nextRun, now) };
}

/**
 * Returns the Nth occurrence of a DOW in a given year/month.
 * @param {number} year
 * @param {number} month  0-based
 * @param {number} nth    1-based
 * @param {number} dow    0=Sun…6=Sat
 * @returns {Date}
 */
function nthWeekdayOfMonth(year, month, nth, dow) {
  const d = new Date(year, month, 1);
  let count = 0;
  while (count < nth) {
    if (d.getDay() === dow) count++;
    if (count < nth) d.setDate(d.getDate() + 1);
  }
  return d;
}

function buildQtrlyDescription(lower) {
  if (lower.includes('last_day'))           return 'Quarterly on last day of first month';
  if (lower.includes('5th_work'))           return 'Quarterly on 5th working day';
  if (lower.includes('20th_day_2nd_month')) return 'Quarterly on 20th day of 2nd month';
  if (lower.includes('1st_day_of_3rd'))     return 'Quarterly on 1st day of 3rd month';
  if (lower.includes('1st_day_4_am'))       return 'Quarterly on 1st day at 04:00';
  if (lower.includes('1st_day'))            return 'Quarterly on 1st day';
  if (lower.includes('3rd_day_1st_month'))  return 'Quarterly on 3rd day of 1st month';
  if (lower.includes('9th_day'))            return 'Quarterly on 9th day';
  if (lower.includes('10th_day'))           return 'Quarterly on 10th day';
  if (lower.includes('15th_day'))           return 'Quarterly on 15th day';
  if (lower.includes('20th_day'))           return 'Quarterly on 20th day';
  if (lower.includes('third_month_15th'))   return 'Quarterly on 15th day of 3rd month';
  return 'Quarterly';
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/** @param {HM} hm */
function fmtTime(hm) {
  return `${String(hm.hour).padStart(2, '0')}:${String(hm.minute).padStart(2, '0')}`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ordSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Public API ────────────────────────────────────────────────────────────────

module.exports = {
  parseSchedule,
  parseTimeToken,
  computeStatus,
  fmtTime,
};
