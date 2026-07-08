import { BadRequestException } from '@nestjs/common';
import type { TimesheetSummaryPeriod } from '@fabxpert/shared/dto/timesheet.dto';

export type ResolvedSummaryPeriod = {
  period: TimesheetSummaryPeriod;
  from: Date | null;
  to: Date | null;
};

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string, field: string): Date {
  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (!match) {
    throw new BadRequestException(`Invalid ${field} date`);
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
    throw new BadRequestException(`Invalid ${field} date`);
  }

  return date;
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function startOfTomorrow(now: Date): Date {
  const tomorrow = startOfToday(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

/** Server-local calendar ranges; timezone simplification is intentional. */
export function resolveSummaryPeriodRange(
  period: TimesheetSummaryPeriod,
  now = new Date(),
): ResolvedSummaryPeriod {
  if (period === 'all') {
    return { period, from: null, to: null };
  }

  if (period === 'today') {
    return {
      period,
      from: startOfToday(now),
      to: startOfTomorrow(now),
    };
  }

  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return { period, from, to };
  }

  if (period === 'week') {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const from = startOfToday(now);
    from.setDate(from.getDate() + diffToMonday);

    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    return { period, from, to };
  }

  throw new BadRequestException('Custom period requires from and to');
}

export function parseSummaryPeriodQuery(query: Record<string, string>): ResolvedSummaryPeriod {
  const periodResult = zSafePeriod(query.period ?? 'today');
  if (!periodResult) {
    throw new BadRequestException('Invalid period');
  }

  if (periodResult === 'custom') {
    const fromRaw = query.from?.trim();
    const toRaw = query.to?.trim();
    if (!fromRaw || !toRaw) {
      throw new BadRequestException('from and to are required for custom period');
    }

    const from = parseDateOnly(fromRaw, 'from');
    const toExclusive = parseDateOnly(toRaw, 'to');
    toExclusive.setDate(toExclusive.getDate() + 1);

    if (from >= toExclusive) {
      throw new BadRequestException('from must be on or before to');
    }

    return { period: 'custom', from, to: toExclusive };
  }

  return resolveSummaryPeriodRange(periodResult);
}

function zSafePeriod(value: string): TimesheetSummaryPeriod | null {
  if (
    value === 'today' ||
    value === 'week' ||
    value === 'month' ||
    value === 'all' ||
    value === 'custom'
  ) {
    return value;
  }
  return null;
}

export function getTodayRange(now = new Date()): { from: Date; to: Date } {
  return {
    from: startOfToday(now),
    to: startOfTomorrow(now),
  };
}
