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

const oneDecimalFormat = new Intl.NumberFormat('ro-RO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Kilograms read as tonnes on screen — the unit the shop floor talks in. */
export function formatTons(weightKg: number | null): string {
  if (weightKg === null || weightKg <= 0) {
    return '—';
  }
  return `${oneDecimalFormat.format(weightKg / 1000)} t`;
}

export function formatPct(pct: number | null): string {
  return pct === null ? '—' : `${pct}%`;
}

/** The norm itself: "14,2 h/t". */
export function formatHoursPerTon(value: number | null): string {
  return value === null ? '—' : `${oneDecimalFormat.format(value)} h/t`;
}

/** "3 aug 2026" — for the first and last day worked on a project. */
export function formatDayLabel(day: string | null): string {
  if (!day) {
    return '—';
  }
  const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, date));
}

export type GapTone = 'good' | 'bad' | 'neutral';

/**
 * How far the hours are running ahead of the work. A gap under 15 points is
 * noise — estimates and assembly lists are never that precise — so only a real
 * divergence gets a colour.
 */
export function gapTone(gapPct: number | null): GapTone {
  if (gapPct === null || Math.abs(gapPct) < 15) {
    return 'neutral';
  }
  return gapPct > 0 ? 'bad' : 'good';
}

/** "+24 pp" — the gap is a difference between two percentages, not a ratio. */
export function formatGap(gapPct: number | null): string {
  if (gapPct === null) {
    return '—';
  }
  return `${gapPct > 0 ? '+' : ''}${gapPct} pp`;
}

/** "peste 12 zile", "azi", "acum 3 zile" — the deadline, read from today. */
export function formatDaysToDue(days: number | null): string {
  if (days === null) {
    return 'fără termen';
  }
  if (days === 0) {
    return 'termen azi';
  }
  if (days > 0) {
    return `${days} ${days === 1 ? 'zi' : 'zile'} până la termen`;
  }
  const late = Math.abs(days);
  return `întârziat ${late} ${late === 1 ? 'zi' : 'zile'}`;
}
