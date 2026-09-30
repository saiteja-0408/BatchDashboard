/**
 * scheduleParser.test.js — unit tests for server/utils/scheduleParser.js
 *
 * Tests cover ≥10 distinct schedule name patterns from VALID_SCHEDULE_NAMES.
 * All tests use a fixed "now" date so results are deterministic.
 *
 * Fixed reference time: Wednesday 2024-05-15 09:00:00 local time
 *   - day-of-week: Wednesday (3)
 *   - hour: 09:00
 */

'use strict';

const { parseSchedule, parseTimeToken, fmtTime } = require('../server/utils/scheduleParser');

// ── Fixed "now" for all tests ─────────────────────────────────────────────────
// Wed 2024-05-15 09:00:00 local
const NOW = new Date(2024, 4, 15, 9, 0, 0, 0); // month is 0-based, so 4 = May

// ── Helper ────────────────────────────────────────────────────────────────────
function parse(name) { return parseSchedule(name, NOW); }

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — parseTimeToken
// ══════════════════════════════════════════════════════════════════════════════
describe('parseTimeToken', () => {
  test('5am  → 05:00', () => expect(parseTimeToken('5am')).toEqual({ hour: 5, minute: 0 }));
  test('12pm → 12:00', () => expect(parseTimeToken('12pm')).toEqual({ hour: 12, minute: 0 }));
  test('12am → 00:00 (midnight)', () => expect(parseTimeToken('12am')).toEqual({ hour: 0, minute: 0 }));
  test('3pm  → 15:00', () => expect(parseTimeToken('3pm')).toEqual({ hour: 15, minute: 0 }));
  test('730am → 07:30', () => expect(parseTimeToken('730am')).toEqual({ hour: 7, minute: 30 }));
  test('815am → 08:15', () => expect(parseTimeToken('815am')).toEqual({ hour: 8, minute: 15 }));
  test('0630pm → 18:30', () => expect(parseTimeToken('0630pm')).toEqual({ hour: 18, minute: 30 }));
  test('1140pm → 23:40', () => expect(parseTimeToken('1140pm')).toEqual({ hour: 23, minute: 40 }));
  test('515pm → 17:15', () => expect(parseTimeToken('515pm')).toEqual({ hour: 17, minute: 15 }));
  test('330pm → 15:30', () => expect(parseTimeToken('330pm')).toEqual({ hour: 15, minute: 30 }));
  test('invalid → null', () => expect(parseTimeToken('foo')).toBeNull());
  test('empty → null',   () => expect(parseTimeToken('')).toBeNull());
});

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — parseSchedule: Pattern 1 — daily
// ══════════════════════════════════════════════════════════════════════════════
describe('Pattern 1 — daily schedules', () => {
  // NOW = Wed 09:00. benefits_daily_6am fires at 06:00 → already past → next run = Thu 06:00
  test('benefits_daily_6am: frequency=daily', () => {
    const r = parse('benefits_daily_6am');
    expect(r.frequency).toBe('daily');
    expect(r.description).toBe('Daily at 06:00');
    expect(r.nextRun).not.toBeNull();
    expect(r.nextRun.getHours()).toBe(6);
    expect(r.nextRun.getMinutes()).toBe(0);
    // Since NOW=09:00 > 06:00, nextRun should be tomorrow
    expect(r.nextRun.getDate()).toBe(16);
  });

  // benefits_daily_1030am: NOW=09:00 < 10:30 → nextRun = today at 10:30
  test('benefits_daily_1030am: next run today', () => {
    const r = parse('benefits_daily_1030am');
    expect(r.frequency).toBe('daily');
    expect(r.nextRun.getDate()).toBe(15); // same day
    expect(r.nextRun.getHours()).toBe(10);
    expect(r.nextRun.getMinutes()).toBe(30);
  });

  test('benefits_daily_0630pm: maps to 18:30', () => {
    const r = parse('benefits_daily_0630pm');
    expect(r.frequency).toBe('daily');
    expect(r.nextRun.getHours()).toBe(18);
    expect(r.nextRun.getMinutes()).toBe(30);
  });

  test('benefits_daily_1140pm: maps to 23:40', () => {
    const r = parse('benefits_daily_1140pm');
    expect(r.frequency).toBe('daily');
    expect(r.nextRun.getHours()).toBe(23);
    expect(r.nextRun.getMinutes()).toBe(40);
  });

  test('email_daily_2pm: frequency=daily, 14:00', () => {
    const r = parse('email_daily_2pm');
    expect(r.frequency).toBe('daily');
    expect(r.nextRun.getHours()).toBe(14);
  });

  test('workflow_reports_530am: daily at 05:30', () => {
    const r = parse('workflow_reports_530am');
    expect(r.frequency).toBe('daily');
    expect(r.nextRun.getHours()).toBe(5);
    expect(r.nextRun.getMinutes()).toBe(30);
  });

  test('appeals_reports_145pm: daily at 13:45', () => {
    const r = parse('appeals_reports_145pm');
    expect(r.frequency).toBe('daily');
    expect(r.nextRun.getHours()).toBe(13);
    expect(r.nextRun.getMinutes()).toBe(45);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Pattern 2 — weekly
// ══════════════════════════════════════════════════════════════════════════════
describe('Pattern 2 — weekly schedules', () => {
  // NOW = Wednesday. Next Friday = 2024-05-17
  test('benefits_weekly_friday_6am: DOW=Friday at 06:00', () => {
    const r = parse('benefits_weekly_friday_6am');
    expect(r.frequency).toBe('weekly');
    expect(r.description).toMatch(/Friday/i);
    expect(r.nextRun.getDay()).toBe(5); // Friday
    expect(r.nextRun.getHours()).toBe(6);
  });

  test('benefits_weekly_monday_6am: DOW=Monday', () => {
    const r = parse('benefits_weekly_monday_6am');
    expect(r.frequency).toBe('weekly');
    expect(r.nextRun.getDay()).toBe(1); // Monday
  });

  test('benefits_weekly_sunday_3pm: DOW=Sunday at 15:00', () => {
    const r = parse('benefits_weekly_sunday_3pm');
    expect(r.frequency).toBe('weekly');
    expect(r.nextRun.getDay()).toBe(0); // Sunday
    expect(r.nextRun.getHours()).toBe(15);
  });

  test('benefits_weekly_thursday_9am: DOW=Thursday', () => {
    const r = parse('benefits_weekly_thursday_9am');
    expect(r.frequency).toBe('weekly');
    expect(r.nextRun.getDay()).toBe(4); // Thursday
    expect(r.nextRun.getHours()).toBe(9);
  });

  test('benefits_sat_4am: Saturday at 04:00', () => {
    const r = parse('benefits_sat_4am');
    expect(r.frequency).toBe('weekly');
    expect(r.nextRun.getDay()).toBe(6); // Saturday
    expect(r.nextRun.getHours()).toBe(4);
  });

  test('reports_sat_7am: Saturday at 07:00', () => {
    const r = parse('reports_sat_7am');
    expect(r.frequency).toBe('weekly');
    expect(r.nextRun.getDay()).toBe(6);
    expect(r.nextRun.getHours()).toBe(7);
  });

  test('MSAccess_reports_saturday_4am: Saturday at 04:00', () => {
    const r = parse('MSAccess_reports_saturday_4am');
    expect(r.frequency).toBe('weekly');
    expect(r.nextRun.getDay()).toBe(6);
    expect(r.nextRun.getHours()).toBe(4);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Pattern 3 — monthly
// ══════════════════════════════════════════════════════════════════════════════
describe('Pattern 3 — monthly schedules', () => {
  // NOW = 15 May. monthly on 1st → next = 1 Jun
  test('benefits_monthly_1st_day_6am: monthly day 1 at 06:00', () => {
    const r = parse('benefits_monthly_1st_day_6am');
    expect(r.frequency).toBe('monthly');
    expect(r.nextRun.getDate()).toBe(1);
    expect(r.nextRun.getMonth()).toBe(5); // June
    expect(r.nextRun.getHours()).toBe(6);
  });

  // monthly on 20th → still ahead in May
  test('benefits_monthly_8th_day_6am: next on 8th', () => {
    const r = parse('benefits_monthly_8th_day_6am');
    expect(r.frequency).toBe('monthly');
    // 8th May is in the past (NOW=15 May), so should be 8 Jun
    expect(r.nextRun.getDate()).toBe(8);
    expect(r.nextRun.getMonth()).toBe(5);
  });

  test('benefits_monthly_last_day_7pm: last day of month at 19:00', () => {
    const r = parse('benefits_monthly_last_day_7pm');
    expect(r.frequency).toBe('monthly');
    expect(r.description).toMatch(/last day/i);
    expect(r.nextRun.getHours()).toBe(19);
    // 31 May is after NOW=15 May → nextRun = 31 May
    expect(r.nextRun.getMonth()).toBe(4); // May
    expect(r.nextRun.getDate()).toBe(31);
  });

  test('benefits_monthly_2nd_monday_6am: 2nd Monday of month', () => {
    const r = parse('benefits_monthly_2nd_monday_6am');
    expect(r.frequency).toBe('monthly');
    expect(r.nextRun.getDay()).toBe(1); // Monday
  });

  test('monthly_1st_sunday: 1st Sunday of month', () => {
    const r = parse('monthly_1st_sunday');
    expect(r.frequency).toBe('monthly');
    expect(r.nextRun.getDay()).toBe(0); // Sunday
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Pattern 4 — quarterly
// ══════════════════════════════════════════════════════════════════════════════
describe('Pattern 4 — quarterly schedules', () => {
  test('benefits_qtrly_1st_day: quarterly, frequency=quarterly', () => {
    const r = parse('benefits_qtrly_1st_day');
    expect(r.frequency).toBe('quarterly');
    expect(r.description).toMatch(/quarterly/i);
    expect(r.nextRun).not.toBeNull();
  });

  test('benefits_qtrly_9th_day_530pm: quarterly at 17:30', () => {
    const r = parse('benefits_qtrly_9th_day_530pm');
    expect(r.frequency).toBe('quarterly');
    // Next quarterly 9th at 17:30 from 15 May 2024 = 9 Jul 2024
    expect(r.nextRun.getHours()).toBe(17);
    expect(r.nextRun.getMinutes()).toBe(30);
  });

  test('benefits_eb_qtrly_9th_day_530pm: quarterly', () => {
    const r = parse('benefits_eb_qtrly_9th_day_530pm');
    expect(r.frequency).toBe('quarterly');
  });

  test('benefits_peuc_qtrly_9th_day_530pm: quarterly', () => {
    const r = parse('benefits_peuc_qtrly_9th_day_530pm');
    expect(r.frequency).toBe('quarterly');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Pattern 5 — on_demand / unscheduled
// ══════════════════════════════════════════════════════════════════════════════
describe('Pattern 5 — on_demand / unscheduled', () => {
  test('on_demand: frequency=on_demand, status=unknown', () => {
    const r = parse('on_demand');
    expect(r.frequency).toBe('on_demand');
    expect(r.status).toBe('unknown');
    expect(r.nextRun).toBeNull();
  });

  test('corr_dms: frequency=on_demand', () => {
    expect(parse('corr_dms').frequency).toBe('on_demand');
  });

  test('top_recert: frequency=on_demand', () => {
    expect(parse('top_recert').frequency).toBe('on_demand');
  });

  test('user_stat: frequency=on_demand', () => {
    expect(parse('user_stat').frequency).toBe('on_demand');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Pattern 6 — biweekly
// ══════════════════════════════════════════════════════════════════════════════
describe('Pattern 6 — biweekly', () => {
  test('benefits_biweekly_day_5am: frequency=biweekly', () => {
    const r = parse('benefits_biweekly_day_5am');
    expect(r.frequency).toBe('biweekly');
    expect(r.nextRun.getHours()).toBe(5);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Pattern 7 — special
// ══════════════════════════════════════════════════════════════════════════════
describe('Pattern 7 — special and annual', () => {
  test('special_holiday_12pm: frequency=special', () => {
    const r = parse('special_holiday_12pm');
    expect(r.frequency).toBe('special');
    expect(r.nextRun.getHours()).toBe(12);
  });

  test('reports_annual_july_1st: annual, July 1', () => {
    const r = parse('reports_annual_july_1st');
    expect(r.frequency).toBe('annual');
    // NOW=May 2024 → next July 1 = 2024
    expect(r.nextRun.getMonth()).toBe(6); // July
    expect(r.nextRun.getDate()).toBe(1);
  });

  test('top_annual_wednesday_12pm: annual', () => {
    const r = parse('top_annual_wednesday_12pm');
    expect(r.frequency).toBe('annual');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Pattern 8 — multiple days (tue_sat)
// ══════════════════════════════════════════════════════════════════════════════
describe('Pattern 8 — multiple days per week', () => {
  test('benefits_tue_sat_6am: weekly, nearest of Tue/Sat at 06:00', () => {
    const r = parse('benefits_tue_sat_6am');
    expect(r.frequency).toBe('weekly');
    expect(r.description).toMatch(/tuesday.*saturday|saturday.*tuesday/i);
    // NOW = Wed 9am. Next Tue = 21 May, next Sat = 18 May → Sat is closer
    expect(r.nextRun.getDay()).toBe(6); // Saturday
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Pattern 9 — twice daily
// ══════════════════════════════════════════════════════════════════════════════
describe('Pattern 9 — twice daily', () => {
  test('corr_webservice_twice_daily: daily, nextRun at 20:00 since NOW=09:00', () => {
    const r = parse('corr_webservice_twice_daily');
    expect(r.frequency).toBe('daily');
    expect(r.description).toMatch(/twice daily/i);
    // NOW=09:00 → next at 20:00 today
    expect(r.nextRun.getHours()).toBe(20);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Pattern 10 — nth weekday of quarter
// ══════════════════════════════════════════════════════════════════════════════
describe('Pattern 10 — nth weekday of quarter', () => {
  test('xmatch_1st_thursday_of_2ndMonth_of_quarter: quarterly', () => {
    const r = parse('xmatch_1st_thursday_of_2ndMonth_of_quarter');
    expect(r.frequency).toBe('quarterly');
    expect(r.nextRun).not.toBeNull();
    expect(r.nextRun.getDay()).toBe(4); // Thursday
  });

  test('xmatch_2nd_thursday_of_1stMonth_of_quarter: quarterly, Thursday', () => {
    const r = parse('xmatch_2nd_thursday_of_1stMonth_of_quarter');
    expect(r.frequency).toBe('quarterly');
    expect(r.nextRun.getDay()).toBe(4); // Thursday
  });

  test('eta_2nd_thursday_of_2ndMonth_of_quarter: quarterly', () => {
    const r = parse('eta_2nd_thursday_of_2ndMonth_of_quarter');
    expect(r.frequency).toBe('quarterly');
    expect(r.nextRun.getDay()).toBe(4);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Status computation
// ══════════════════════════════════════════════════════════════════════════════
describe('Status computation', () => {
  test('upcoming: schedule fires 30 min from now', () => {
    // benefits_daily_930am: NOW=09:00, schedule=09:30 → upcoming
    const r = parse('benefits_daily_930am');
    expect(r.status).toBe('upcoming');
  });

  test('idle: schedule already ran hours ago', () => {
    // benefits_daily_6am: NOW=09:00, 06:00 was 3h ago → idle (nextRun = tomorrow)
    const r = parse('benefits_daily_6am');
    // nextRun is tomorrow at 06:00 — that's ~21h away — idle
    expect(r.status).toBe('idle');
  });

  test('unknown: on_demand has no nextRun', () => {
    const r = parse('on_demand');
    expect(r.status).toBe('unknown');
    expect(r.nextRun).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — All 128 names must not throw and return valid shape
// ══════════════════════════════════════════════════════════════════════════════
describe('Exhaustive — all VALID_SCHEDULE_NAMES parse without throwing', () => {
  const ALL_NAMES = require('../server/config/constants').VALID_SCHEDULE_NAMES;

  ALL_NAMES.forEach((name) => {
    test(`parseSchedule('${name}') returns valid shape`, () => {
      let result;
      expect(() => { result = parseSchedule(name, NOW); }).not.toThrow();
      expect(result).toHaveProperty('scheduleName', name);
      expect(result).toHaveProperty('frequency');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('status');
      expect(['daily','weekly','biweekly','monthly','quarterly','annual','on_demand','special','unknown']).toContain(result.frequency);
      expect(['active','upcoming','idle','unknown']).toContain(result.status);
      if (result.nextRun !== null) {
        expect(result.nextRun).toBeInstanceOf(Date);
        expect(isNaN(result.nextRun.getTime())).toBe(false);
      }
    });
  });
});
