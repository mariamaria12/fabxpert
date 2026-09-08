/**
 * workDate convention (API, mobile, web):
 * - Semantics: calendar day the work was done (day granularity only).
 * - Wire format: `YYYY-MM-DD` string on create/update (avoids timezone shifts).
 * - Storage: Prisma DateTime at server-local midnight for that calendar day.
 * - When omitted on create, the API defaults workDate to today (server local).
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseWorkDateString(value: string): Date {
  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid workDate: ${value}`);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid workDate: ${value}`);
  }

  return date;
}

export function normalizeWorkDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function todayWorkDate(reference = new Date()): Date {
  return normalizeWorkDate(reference);
}

/** The public holidays with a fixed date, as `MM-DD` (Codul muncii art. 139). */
const FIXED_PUBLIC_HOLIDAYS = [
  '01-01', // Anul Nou
  '01-02',
  '01-06', // Boboteaza
  '01-07', // Sfântul Ion
  '01-24', // Unirea Principatelor Române
  '05-01', // Ziua Muncii
  '06-01', // Ziua Copilului
  '08-15', // Adormirea Maicii Domnului
  '11-30', // Sfântul Andrei
  '12-01', // Ziua Națională
  '12-25', // Crăciunul
  '12-26',
];

/** Days off counted from Easter: Vinerea Mare, the two of Paște, the two of Rusalii. */
const EASTER_HOLIDAY_OFFSETS = [-2, 0, 1, 49, 50];

/** Orthodox Easter Sunday, by Meeus' Julian algorithm. */
function orthodoxEasterSunday(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  // The algorithm answers in the Julian calendar, 13 days behind ours until 2100.
  return new Date(year, month - 1, day + 13);
}

const holidaysByYear = new Map<number, Set<string>>();

function publicHolidayKeys(year: number): Set<string> {
  const cached = holidaysByYear.get(year);
  if (cached) {
    return cached;
  }

  const keys = new Set(FIXED_PUBLIC_HOLIDAYS.map((day) => `${year}-${day}`));
  const easter = orthodoxEasterSunday(year);
  for (const offset of EASTER_HOLIDAY_OFFSETS) {
    keys.add(
      workDateToDayKey(
        new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + offset),
      ),
    );
  }

  holidaysByYear.set(year, keys);
  return keys;
}

/**
 * A Romanian public holiday. One falling on a weekend is not moved: the law
 * gives nothing back for it, and the pontaj we send accounting counts it the
 * same way.
 */
export function isPublicHoliday(date: Date | string): boolean {
  const value = typeof date === 'string' ? new Date(date) : date;
  return publicHolidayKeys(value.getFullYear()).has(workDateToDayKey(value));
}

/** Mon–Fri, minus the public holidays — the norm everything else counts against. */
export function isWorkingDate(date: Date | string): boolean {
  const value = typeof date === 'string' ? new Date(date) : date;
  const dayOfWeek = value.getDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6 && !isPublicHoliday(value);
}

export function workDateToDayKey(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function isSameWorkDate(
  workDate: Date | string,
  reference = new Date(),
): boolean {
  return workDateToDayKey(workDate) === workDateToDayKey(reference);
}

/** `YYYY-MM-DD` for HTML date inputs (local calendar day). */
export function todayDateInputValue(reference = new Date()): string {
  return workDateToDayKey(todayWorkDate(reference));
}
