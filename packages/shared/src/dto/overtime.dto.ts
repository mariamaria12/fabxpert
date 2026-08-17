/**
 * Overtime balance for one Person, in minutes (the UI divides by 60).
 * Closed months come from overtime_accruals; everything after the last closed
 * month is recomputed on every read, so a corrected timesheet shows up at once.
 */
export type OvertimeBalanceDto = {
  personId: string;
  /** Sum of closed months. */
  accruedMinutes: number;
  /** Earned in months that are not closed yet, computed live from timesheets. */
  openPeriodMinutes: number;
  /** Approved RECUPERARE leave, converted to minutes. */
  usedMinutes: number;
  /** accruedMinutes + openPeriodMinutes − usedMinutes. */
  remainingMinutes: number;
  /** Whole days off `remainingMinutes` covers. */
  remainingDays: number;
  /** Last closed month as `YYYY-MM`; null when nothing is closed yet. */
  closedThroughMonth: string | null;
};

/** Result of closing one month for everyone. */
export type CloseOvertimeMonthResponse = {
  /** The month that was closed, as `YYYY-MM`. */
  month: string;
  personsClosed: number;
  totalMinutes: number;
};
