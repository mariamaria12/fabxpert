/** Contractual working day. Anything logged past it accrues as overtime. */
export const DAILY_WORK_MINUTES = 540; // 9h

/**
 * Overtime earned over a set of days, given each day's logged total.
 * Counted per day on purpose: a short day adds nothing, it never cancels a long one.
 */
export function earnedOvertimeMinutes(dailyLoggedMinutes: number[]): number {
  return dailyLoggedMinutes.reduce(
    (sum, logged) => sum + Math.max(0, logged - DAILY_WORK_MINUTES),
    0,
  );
}

/** Whole days off a balance covers — one day off costs a full working day. */
export function overtimeDaysAvailable(balanceMinutes: number): number {
  return Math.floor(balanceMinutes / DAILY_WORK_MINUTES);
}

/** Minutes as hours, no sign: "12h", "12h 30m", "30m". */
export function formatOvertimeHours(minutes: number): string {
  const total = Math.abs(Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;

  if (total === 0) {
    return '0h';
  }
  if (hours === 0) {
    return `${rest}m`;
  }

  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * A balance always carries its sign: "+12h 30m" when there is time to take off,
 * "−4h" when a day was taken before it was earned and has to be worked back.
 */
export function formatOvertimeBalance(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) {
    return '0h';
  }

  return `${rounded > 0 ? '+' : '−'}${formatOvertimeHours(rounded)}`;
}
