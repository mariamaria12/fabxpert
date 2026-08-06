const RO_MONTHS_SHORT = [
  'ian',
  'feb',
  'mar',
  'apr',
  'mai',
  'iun',
  'iul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

const RO_MONTHS_LONG = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
] as const;

function parseIsoDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatRomanianDayMonth(date: Date): string {
  return `${date.getDate()} ${RO_MONTHS_SHORT[date.getMonth()]}`;
}

export function formatRomanianMonthName(date: Date): string {
  return RO_MONTHS_LONG[date.getMonth()];
}

export function formatRomanianDayMonthRange(from: Date, to: Date): string {
  const sameMonth =
    from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();

  if (sameMonth) {
    return `${from.getDate()}–${to.getDate()} ${RO_MONTHS_SHORT[from.getMonth()]}`;
  }

  return `${formatRomanianDayMonth(from)} – ${formatRomanianDayMonth(to)}`;
}

function formatLongDayMonthRange(from: Date, to: Date): string {
  const sameMonth =
    from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();

  if (from.getTime() === to.getTime()) {
    return `${from.getDate()} ${RO_MONTHS_LONG[from.getMonth()]}`;
  }

  if (sameMonth) {
    return `${from.getDate()}–${to.getDate()} ${RO_MONTHS_LONG[from.getMonth()]}`;
  }

  return `${from.getDate()} ${RO_MONTHS_LONG[from.getMonth()]} – ${to.getDate()} ${RO_MONTHS_LONG[to.getMonth()]}`;
}

/**
 * Headline period wording for the panou cards: "azi", "ieri",
 * "săptămâna 3–9 august", "luna august", "3–9 august" for a custom range.
 */
export function formatPeriodLabel(
  kind: 'today' | 'yesterday' | 'week' | 'month' | 'custom',
  now = new Date(),
  custom?: { from: string; to: string },
): string {
  if (kind === 'today') {
    return 'azi';
  }

  if (kind === 'yesterday') {
    return 'ieri';
  }

  if (kind === 'week') {
    const { from, to } = getIsoWeekRange(now);
    return `săptămâna ${formatLongDayMonthRange(from, to)}`;
  }

  if (kind === 'month') {
    return `luna ${formatRomanianMonthName(now)}`;
  }

  const from = custom?.from ? parseIsoDateOnly(custom.from) : null;
  const to = custom?.to ? parseIsoDateOnly(custom.to) : null;
  if (!from || !to) {
    return 'interval';
  }

  return formatLongDayMonthRange(from, to);
}

export function formatCustomPeriodSubLabel(from: string, to: string): string {
  const fromDate = parseIsoDateOnly(from);
  const toDate = parseIsoDateOnly(to);

  if (!fromDate || !toDate) {
    return 'alege';
  }

  return formatRomanianDayMonthRange(fromDate, toDate);
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getIsoWeekRange(now = new Date()): { from: Date; to: Date } {
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const from = startOfToday(now);
  from.setDate(from.getDate() + diffToMonday);

  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  return { from, to };
}

export function getCalendarMonthRange(now = new Date()): { from: Date; to: Date } {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from, to };
}

export function formatPeriodCardSubLabel(
  kind: 'today' | 'yesterday' | 'week' | 'month' | 'custom',
  now = new Date(),
  custom?: { from: string; to: string },
): string {
  if (kind === 'today') {
    return formatRomanianDayMonth(now);
  }

  if (kind === 'yesterday') {
    const yesterday = startOfToday(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatRomanianDayMonth(yesterday);
  }

  if (kind === 'week') {
    const { from, to } = getIsoWeekRange(now);
    return formatRomanianDayMonthRange(from, to);
  }

  if (kind === 'month') {
    return formatRomanianMonthName(now);
  }

  if (custom?.from && custom?.to) {
    return formatCustomPeriodSubLabel(custom.from, custom.to);
  }

  return 'alege';
}
