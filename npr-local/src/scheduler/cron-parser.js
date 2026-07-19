/**
 * cron-parser.js — Minimal cron expression parser.
 *
 * Supports 5-field expressions (minute hour dom month dow).
 * Wildcards (asterisk), ranges (1-5), steps (step/N), lists (1,3,5),
 * and named month/day abbreviations (JAN, MON, etc.).
 *
 * Returns the next N fire dates after a reference time.
 * Pure Node.js, zero dependencies.
 */

const MONTH_ALIASES = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const DAY_ALIASES = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/**
 * Parse a single cron field into a set of allowed values.
 * @param {string} field - Cron field string
 * @param {number} min - Minimum valid value
 * @param {number} max - Maximum valid value
 * @param {object} aliases - Named aliases (e.g. JAN→0)
 * @returns {Set<number>}
 */
function parseField(field, min, max, aliases = {}) {
  const values = new Set();

  // Split by comma for lists
  const parts = field.split(',');
  for (const part of parts) {
    const trimmed = part.trim().toLowerCase();

    // Handle step: */N or range/N
    const stepMatch = trimmed.match(/^(.+?)\/(\d+)$/);
    if (stepMatch) {
      const [, range, stepStr] = stepMatch;
      const step = parseInt(stepStr, 10);
      if (step <= 0) {
        throw new Error(`Invalid step value: ${stepStr}`);
      }

      let start = min;
      let end = max;
      if (range !== '*') {
        const [s, e] = range.split('-').map((v) => resolveAlias(v, aliases));
        start = s !== undefined ? s : min;
        end = e !== undefined ? e : max;
      }

      for (let v = start; v <= end; v += step) {
        values.add(v);
      }
      continue;
    }

    // Handle range: 1-5
    const rangeMatch = trimmed.match(/^(.+?)-(.+)$/);
    if (rangeMatch) {
      const [s, e] = rangeMatch.slice(1).map((v) => resolveAlias(v, aliases));
      if (s === undefined || e === undefined) {
        throw new Error(`Invalid range: ${trimmed}`);
      }
      for (let v = s; v <= e; v++) {
        values.add(v);
      }
      continue;
    }

    // Single value or wildcard
    const resolved = resolveAlias(trimmed, aliases);
    if (resolved === undefined && trimmed !== '*') {
      throw new Error(`Invalid cron field value: ${trimmed}`);
    }

    if (trimmed === '*') {
      for (let v = min; v <= max; v++) {
        values.add(v);
      }
    } else if (resolved !== undefined) {
      values.add(resolved);
    }
  }

  return values;
}

/** Resolve a value or alias to a number. */
function resolveAlias(val, aliases) {
  const lower = val.toLowerCase();
  if (aliases[lower] !== undefined) return aliases[lower];
  const num = parseInt(val, 10);
  return Number.isNaN(num) ? undefined : num;
}

/**
 * Validate and parse a full cron expression.
 *
 * @param {string} expr - 5-field cron expression
 * @returns {object} Parsed cron fields { minutes, hours, daysOfMonth, months, daysOfWeek }
 */
function parseCron(expr) {
  if (typeof expr !== 'string') {
    throw new TypeError('Cron expression must be a string');
  }

  // Allow optional 6-field (with seconds) — just ignore seconds for now
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    throw new Error(
      `Invalid cron expression: expected 5 or 6 fields, got ${parts.length}`
    );
  }

  // If 6 fields, drop the seconds field (index 0)
  const [minute, hour, dom, month, dow] = parts.length === 6 ? parts.slice(1) : parts;

  return {
    minutes: parseField(minute, 0, 59),
    hours: parseField(hour, 0, 23),
    daysOfMonth: parseField(dom, 1, 31),
    months: parseField(month, 0, 11, MONTH_ALIASES),
    daysOfWeek: parseField(dow, 0, 6, DAY_ALIASES),
  };
}

/**
 * Compute the next fire date(s) after `since`.
 *
 * Brute-force approach: increment by minutes until a match.
 * Fast enough for practical scheduling (max ~14 days of scanning).
 *
 * @param {object} parsed - Output of parseCron()
 * @param {Date} since - Reference time (exclusive)
 * @param {number} count - How many future dates to return (default 1)
 * @returns {Date[]}
 */
function nextRun(parsed, since = new Date(), count = 1) {
  const results = [];
  const maxIterations = 366 * 24 * 60; // ~1 year of minutes (safety cap)
  let iter = 0;
  let candidate = new Date(since.getTime() + 60_000); // start 1 min ahead
  candidate.setSeconds(0, 0);

  while (results.length < count && iter < maxIterations) {
    iter++;

    const m = candidate.getMonth();
    const d = candidate.getDate();
    const dow = candidate.getDay();
    const h = candidate.getHours();
    const min = candidate.getMinutes();

    const monthOk = parsed.months.has(m);
    const domOk = parsed.daysOfMonth.has(d);
    const dowOk = parsed.daysOfWeek.has(dow);
    const hourOk = parsed.hours.has(h);
    const minOk = parsed.minutes.has(min);

    // Day matching: dom OR dow (standard cron semantics: if both restricted, either can match)
    const domRestricted = parsed.daysOfMonth.size < 31;
    const dowRestricted = parsed.daysOfWeek.size < 7;
    const dayOk = domRestricted && dowRestricted
      ? domOk || dowOk
      : (domRestricted ? domOk : dowOk);

    if (monthOk && dayOk && hourOk && minOk) {
      results.push(new Date(candidate));
      candidate.setMinutes(candidate.getMinutes() + 1);
      continue;
    }

    // Skip ahead intelligently:
    if (!parsed.minutes.has(min)) {
      // Jump to next matching minute
      const nextMin = [...parsed.minutes].filter((v) => v > min).sort((a, b) => a - b)[0];
      if (nextMin !== undefined) {
        candidate.setMinutes(nextMin, 0, 0);
      } else {
        candidate.setMinutes(0, 0, 0);
        candidate.setHours(candidate.getHours() + 1);
      }
      continue;
    }

    if (!parsed.hours.has(h)) {
      const nextHour = [...parsed.hours].filter((v) => v > h).sort((a, b) => a - b)[0];
      if (nextHour !== undefined) {
        candidate.setHours(nextHour);
        candidate.setMinutes([...parsed.minutes].sort((a, b) => a - b)[0]);
      } else {
        candidate.setHours(0);
        candidate.setMinutes([...parsed.minutes].sort((a, b) => a - b)[0]);
        candidate.setDate(candidate.getDate() + 1);
      }
      continue;
    }

    // Skip day if month or day doesn't match
    if (!monthOk || !dayOk) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(
        [...parsed.hours].sort((a, b) => a - b)[0],
        [...parsed.minutes].sort((a, b) => a - b)[0],
        0,
        0
      );
      continue;
    }

    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return results;
}

module.exports = { parseCron, nextRun };
