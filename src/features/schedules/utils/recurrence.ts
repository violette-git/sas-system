// ── Recurrence rule types ─────────────────────────────────────────────────────

export type RepeatType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

/** 0=Sun … 6=Sat */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface RecurrenceRule {
  type: RepeatType;
  /** For weekly/biweekly: which days (0–6) to repeat on */
  days?: DayOfWeek[];
  /** Stop after this many occurrences (if set, takes priority over end_date) */
  count?: number;
  /** Stop on or before this YYYY-MM-DD date */
  end_date?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Expand a recurrence rule into individual date strings (YYYY-MM-DD) within
 * [rangeStart, rangeEnd]. The first occurrence is always on `startDate`.
 *
 * @param startDate  Base date of the first occurrence (YYYY-MM-DD or Date)
 * @param rule       RecurrenceRule describing the repeat pattern
 * @param rangeStart Window start (inclusive)
 * @param rangeEnd   Window end (inclusive)
 * @param maxResults Safety cap to avoid runaway loops (default 500)
 */
export function generateOccurrences(
  startDate: string | Date,
  rule: RecurrenceRule,
  rangeStart: string | Date,
  rangeEnd: string | Date,
  maxResults = 500,
): string[] {
  if (rule.type === 'none') return [];

  const base    = typeof startDate === 'string' ? new Date(startDate + 'T00:00:00') : new Date(startDate);
  const winStart = typeof rangeStart === 'string' ? new Date(rangeStart + 'T00:00:00') : new Date(rangeStart);
  const winEnd   = typeof rangeEnd === 'string' ? new Date(rangeEnd + 'T00:00:00') : new Date(rangeEnd);
  const ruleEnd  = rule.end_date ? new Date(rule.end_date + 'T00:00:00') : null;

  const results: string[] = [];
  let count = 0;

  function inWindow(d: Date): boolean {
    return d >= winStart && d <= winEnd;
  }

  function pastEnd(d: Date): boolean {
    if (ruleEnd && d > ruleEnd) return true;
    if (rule.count !== undefined && count >= rule.count) return true;
    return d > winEnd;
  }

  switch (rule.type) {
    case 'daily': {
      let cur = new Date(base);
      while (!pastEnd(cur)) {
        if (inWindow(cur)) {
          results.push(toDateStr(cur));
          if (results.length >= maxResults) break;
        }
        count++;
        cur = addDays(cur, 1);
      }
      break;
    }

    case 'weekly':
    case 'biweekly': {
      const interval = rule.type === 'biweekly' ? 14 : 7;
      const targetDays: Set<number> = new Set(rule.days ?? [base.getDay() as DayOfWeek]);

      // Start from the Monday of the base week
      let weekBase = new Date(base);
      weekBase.setDate(weekBase.getDate() - weekBase.getDay()); // go to Sunday

      while (!pastEnd(weekBase)) {
        for (let d = 0; d < 7; d++) {
          const day = addDays(weekBase, d);
          if (day < base) continue; // skip days before start
          if (targetDays.has(day.getDay())) {
            if (pastEnd(day)) break;
            if (inWindow(day)) {
              results.push(toDateStr(day));
              if (results.length >= maxResults) return results;
            }
            count++;
          }
        }
        weekBase = addDays(weekBase, interval);
      }
      break;
    }

    case 'monthly': {
      let cur = new Date(base);
      while (!pastEnd(cur)) {
        if (inWindow(cur)) {
          results.push(toDateStr(cur));
          if (results.length >= maxResults) break;
        }
        count++;
        cur = addMonths(cur, 1);
      }
      break;
    }
  }

  return results;
}
