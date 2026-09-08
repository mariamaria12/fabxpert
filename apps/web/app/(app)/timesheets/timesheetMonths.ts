/** `YYYY-MM` helpers for the month-based tabs (approvals, accounting). */

import { latestSettleableMonth as settleableMonthStart, settlementOpensOn } from '@fabxpert/shared';

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * The month an admin approves now: the current one once its last week starts,
 * the one before it until then.
 */
export function latestSettleableMonth(reference = new Date()): string {
  return monthKey(settleableMonthStart(reference));
}

/** "24 septembrie" — the day the month's approvals open. */
export function settlementOpensLabel(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return settlementOpensOn(new Date(year, monthIndex - 1, 1)).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
  });
}

export function currentMonth(reference = new Date()): string {
  return monthKey(reference);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return monthKey(new Date(year, monthIndex - 1 + delta, 1));
}

/** "August 2026" for `2026-08`. */
export function formatMonthLabel(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  const label = new Date(year, monthIndex - 1, 1).toLocaleDateString('ro-RO', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "1 – 31 August 2026" for `2026-08`. */
export function formatMonthRange(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  return `1 – ${lastDay} ${formatMonthLabel(month)}`;
}
