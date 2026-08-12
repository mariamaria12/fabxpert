import type { ReportPeriodKind } from '@fabxpert/shared';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';

const hoursNumberFormat = new Intl.NumberFormat('ro-RO');

/** Whole hours, grouped ("3.240h"); minutes rarely matter at this altitude. */
export function formatHours(minutes: number): string {
  return `${hoursNumberFormat.format(Math.round(minutes / 60))}h`;
}

/** Exact duration ("128h 30m") for KPI values and tooltips. */
export function formatExactDuration(minutes: number): string {
  return formatDurationMinutes(minutes);
}

function parseDayKey(day: string): Date {
  const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, date);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "August 2026", or "1 – 15 august 2026" for a partial range. */
export function formatRangeLabel(from: string, to: string): string {
  const start = parseDayKey(from);
  const end = parseDayKey(to);

  const monthYear = new Intl.DateTimeFormat('ro-RO', {
    month: 'long',
    year: 'numeric',
  });

  const startsMonth = start.getDate() === 1;
  const endsMonth =
    end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();

  // A whole calendar month reads best as just "August 2026".
  if (sameMonth && startsMonth && endsMonth) {
    return capitalize(monthYear.format(start));
  }

  const dayMonth = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' });
  const dayMonthYear = new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${dayMonth.format(start)} – ${dayMonthYear.format(end)}`;
}

const PERIOD_PREFIX: Record<ReportPeriodKind, string> = {
  lastMonth: 'Luna trecută',
  currentMonth: 'Luna curentă',
  custom: 'Interval',
};

export function periodHeading(period: ReportPeriodKind, from: string, to: string): string {
  return `${PERIOD_PREFIX[period]} · ${formatRangeLabel(from, to)}`;
}

export type EfficiencyTone = 'good' | 'bad' | 'neutral';

export function efficiencyTone(pct: number | null): EfficiencyTone {
  if (pct === null) {
    return 'neutral';
  }
  return pct >= 100 ? 'good' : 'bad';
}

export function formatEfficiency(pct: number | null): string {
  return pct === null ? '—' : `${pct}%`;
}

export function efficiencySubLabel(pct: number | null): string {
  if (pct === null) {
    return 'fără date';
  }
  return pct >= 100 ? 'sub buget' : 'peste buget';
}
