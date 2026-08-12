import { BadRequestException } from '@nestjs/common';
import type { ReportPeriodKind } from '@fabxpert/shared/dto/report.dto';

export type ResolvedReportPeriod = {
  period: ReportPeriodKind;
  /** Inclusive start of the interval (server-local midnight). */
  from: Date;
  /** Exclusive end of the interval (server-local midnight of the day after). */
  toExclusive: Date;
  /** `YYYY-MM-DD` of the inclusive start, for display. */
  fromDay: string;
  /** `YYYY-MM-DD` of the inclusive last day, for display. */
  toDay: string;
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

function formatDayKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The inclusive last day is one day before the exclusive boundary. */
function inclusiveEnd(toExclusive: Date): Date {
  const end = new Date(toExclusive);
  end.setDate(end.getDate() - 1);
  return end;
}

/** Server-local calendar ranges; timezone simplification is intentional. */
export function parseReportPeriodQuery(
  query: Record<string, string>,
  now = new Date(),
): ResolvedReportPeriod {
  const kind = query.period ?? 'lastMonth';

  if (kind === 'lastMonth') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const toExclusive = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return {
      period: 'lastMonth',
      from,
      toExclusive,
      fromDay: formatDayKey(from),
      toDay: formatDayKey(inclusiveEnd(toExclusive)),
    };
  }

  if (kind === 'currentMonth') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const toExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return {
      period: 'currentMonth',
      from,
      toExclusive,
      fromDay: formatDayKey(from),
      toDay: formatDayKey(inclusiveEnd(toExclusive)),
    };
  }

  if (kind === 'custom') {
    const fromRaw = query.from?.trim();
    const toRaw = query.to?.trim();
    if (!fromRaw || !toRaw) {
      throw new BadRequestException('from and to are required for custom period');
    }

    const from = parseDateOnly(fromRaw, 'from');
    const toInclusive = parseDateOnly(toRaw, 'to');
    const toExclusive = new Date(toInclusive);
    toExclusive.setDate(toExclusive.getDate() + 1);

    if (from >= toExclusive) {
      throw new BadRequestException('from must be on or before to');
    }

    return {
      period: 'custom',
      from,
      toExclusive,
      fromDay: formatDayKey(from),
      toDay: formatDayKey(toInclusive),
    };
  }

  throw new BadRequestException('Invalid period');
}

/**
 * A resolved interval is fully in the past (and thus safe to cache aggressively)
 * when its exclusive end is at or before the start of the current day.
 */
export function isPastInterval(resolved: ResolvedReportPeriod, now = new Date()): boolean {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return resolved.toExclusive.getTime() <= startOfToday.getTime();
}
