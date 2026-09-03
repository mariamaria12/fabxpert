// Types for the Rapoarte productivity analytics. The page covers delivered
// work — LIVRAT and FINALIZAT projects — grouped by the interval their
// completion date falls into. See PROJECT_COMPLETED_STATUSES.

export const REPORT_PERIOD_KINDS = ['lastMonth', 'currentMonth', 'custom'] as const;
export type ReportPeriodKind = (typeof REPORT_PERIOD_KINDS)[number];

export type ProductivityKpis = {
  /** LIVRAT and FINALIZAT projects whose completion date is inside the interval. */
  completedCount: number;
  /** Completed on or before the deadline (by calendar day). */
  onTimeCount: number;
  /** Completed after the deadline. */
  lateCount: number;
  /** Completed projects without a deadline — neither on-time nor late. */
  noDueDateCount: number;
  totalWorkedMinutes: number;
  /** Sum of the estimates of the projects that have one filled in. */
  totalEstimatedMinutes: number;
  /**
   * Pooled Σ(estimated) / Σ(worked) × 100 over projects that have both an
   * estimate and logged time. Above 100 = under budget (good),
   * below 100 = over budget. `null` when it can't be computed.
   */
  efficiencyPct: number | null;
};

/** One project row for the worked-vs-estimated comparison chart. */
export type ProjectHoursComparisonRow = {
  id: string;
  code: string;
  /** denumireLucrare when present, otherwise the project name. */
  label: string;
  companyName: string;
  workedMinutes: number;
  /** From the project's estimated hours; null when that field is empty. */
  estimatedMinutes: number | null;
};

export type OnTimeBreakdown = {
  onTime: number;
  late: number;
  noDueDate: number;
};

/** A `null` id marks the aggregated "others" bucket beyond the top N. */
export type ClientHoursRow = {
  companyId: string | null;
  companyName: string;
  color: string | null;
  workedMinutes: number;
};

/** A `null` id marks entries without an activity or the "others" bucket. */
export type ActivityHoursRow = {
  activityId: string | null;
  activityName: string;
  color: string | null;
  workedMinutes: number;
};

export type ProductivityReportResponse = {
  period: ReportPeriodKind;
  /** Resolved interval, inclusive, as `YYYY-MM-DD` calendar days. */
  from: string;
  to: string;
  kpis: ProductivityKpis;
  /** Top projects by worked time, for the comparison chart. */
  projectHours: ProjectHoursComparisonRow[];
  onTime: OnTimeBreakdown;
  /** Top clients by worked time, plus an optional "others" bucket. */
  byClient: ClientHoursRow[];
  /** Top activities by worked time, plus an optional "others" bucket. */
  byActivity: ActivityHoursRow[];
};
