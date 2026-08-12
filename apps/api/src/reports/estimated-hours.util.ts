// Estimated effort for a project = working days (Mon–Fri, minus holidays)
// between its start and deadline, inclusive, times the hours-per-day rate.
//
// Both knobs below are meant to be easy to change. `HOURS_PER_DAY` is the rate;
// `ESTIMATE_HOLIDAYS` holds days to exclude — `MM-DD` recurs every year, and a
// full `YYYY-MM-DD` targets a single year (e.g. movable Orthodox Easter dates).
// This is applied per project for now.

export const HOURS_PER_DAY = 9;

export const ESTIMATE_HOLIDAYS: readonly string[] = [
  '01-01', // Anul Nou
  '01-02', // Anul Nou
  '01-24', // Unirea Principatelor Române
  '05-01', // Ziua Muncii
  '06-01', // Ziua Copilului
  '08-15', // Adormirea Maicii Domnului
  '11-30', // Sfântul Andrei
  '12-01', // Ziua Națională
  '12-25', // Crăciun
  '12-26', // Crăciun
];

export type EstimateOptions = {
  hoursPerDay?: number;
  holidays?: readonly string[];
};

function atLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(date: Date, holidays: readonly string[]): boolean {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).padStart(4, '0');
  return holidays.includes(`${month}-${day}`) || holidays.includes(`${year}-${month}-${day}`);
}

/** Working days between two dates, inclusive of both endpoints. */
export function countBusinessDays(
  start: Date,
  end: Date,
  holidays: readonly string[] = ESTIMATE_HOLIDAYS,
): number {
  const cursor = atLocalMidnight(start);
  const last = atLocalMidnight(end);
  if (last < cursor) {
    return 0;
  }

  let count = 0;
  while (cursor <= last) {
    if (!isWeekend(cursor) && !isHoliday(cursor, holidays)) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Estimated minutes for a project, or `null` when start or deadline is missing
 * or the deadline precedes the start.
 */
export function estimateMinutes(
  startDate: Date | null,
  dueDate: Date | null,
  options: EstimateOptions = {},
): number | null {
  if (!startDate || !dueDate) {
    return null;
  }

  const start = atLocalMidnight(startDate);
  const due = atLocalMidnight(dueDate);
  if (due < start) {
    return null;
  }

  const hoursPerDay = options.hoursPerDay ?? HOURS_PER_DAY;
  const businessDays = countBusinessDays(start, due, options.holidays);
  return Math.round(businessDays * hoursPerDay * 60);
}
