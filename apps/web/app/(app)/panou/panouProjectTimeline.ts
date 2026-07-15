import { formatProjectDueDate } from '@fabxpert/shared';

function startOfLocalDay(value: Date | string): Date {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getProjectTimelineDates(
  startDate: string | null,
  dueDate: string | null,
): { startDate: string; dueDate: string } | null {
  if (!startDate || !dueDate) {
    return null;
  }

  return { startDate, dueDate };
}

/** @deprecated Prefer getProjectTimelineDates for narrowing both fields. */
export function hasProjectTimelineDates(
  startDate: string | null,
  dueDate: string | null,
): startDate is string {
  return Boolean(startDate && dueDate);
}

export function formatProjectTimelineRange(startDate: string, dueDate: string): string {
  return `${formatProjectDueDate(startDate)} – ${formatProjectDueDate(dueDate)}`;
}

export function getProjectDaysRemainingLabel(
  dueDate: string,
  now = new Date(),
): { text: string; className: string } {
  const due = startOfLocalDay(dueDate);
  const today = startOfLocalDay(now);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays > 0) {
    return { text: `${diffDays} zile rămase`, className: 'text-text-muted' };
  }

  if (diffDays === 0) {
    return { text: 'Termen azi', className: 'text-accent' };
  }

  return {
    text: `Întârziat cu ${Math.abs(diffDays)} zile`,
    className: 'text-danger',
  };
}

export function getProjectTimelineProgress(
  startDate: string,
  dueDate: string,
  now = new Date(),
): number {
  const start = startOfLocalDay(startDate).getTime();
  const due = startOfLocalDay(dueDate).getTime();
  const today = startOfLocalDay(now).getTime();

  if (due <= start) {
    return 100;
  }

  return Math.min(100, Math.max(0, Math.round(((today - start) / (due - start)) * 100)));
}

export function isProjectTimelineOverdue(dueDate: string, now = new Date()): boolean {
  return startOfLocalDay(dueDate).getTime() < startOfLocalDay(now).getTime();
}
