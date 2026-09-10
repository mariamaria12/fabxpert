// Types for the Rapoarte productivity analytics. The page covers delivered
// work — LIVRAT and FINALIZAT projects — grouped by the interval their
// completion date falls into. See PROJECT_COMPLETED_STATUSES.

import type { ProjectStatus } from './project.dto';

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

// ---------------------------------------------------------------------------
// Fișa proiectului — one project, read across activities and people.
// ---------------------------------------------------------------------------

/** How far one assembly-tracked step has got, in pieces and kilograms. */
export type AssemblyStepProgress = {
  piecesDone: number;
  piecesTotal: number;
  weightDoneKg: number;
  weightTotalKg: number;
  /** The slice of the two above closed by hand instead of through a timesheet. */
  piecesManual: number;
  weightManualKg: number;
};

export type ProjectReportActivityRow = {
  /** Null for time logged without an activity. */
  activityId: string | null;
  activityName: string;
  color: string | null;
  workedMinutes: number;
  /** Null when the activity is not tracked assembly by assembly. */
  progress: AssemblyStepProgress | null;
};

export type ProjectReportPersonRow = {
  personId: string;
  personName: string;
  roleName: string | null;
  workedMinutes: number;
  /** Only the activities this person actually logged; same ids as byActivity. */
  byActivity: { activityId: string | null; minutes: number }[];
};

export type ProjectReportTotals = {
  workedMinutes: number;
  estimatedMinutes: number | null;
  /** Σ(estimated) / Σ(worked) × 100 — above 100 = under budget. */
  efficiencyPct: number | null;
  /** Worked hours per ton of steel; null while the project carries no weight. */
  hoursPerTon: number | null;
  peopleCount: number;
  /** First and last day carrying a timesheet, as `YYYY-MM-DD`. */
  firstWorkDay: string | null;
  lastWorkDay: string | null;
};

export type ProjectReportResponse = {
  project: {
    id: string;
    code: string;
    /** denumireLucrare when present, otherwise the project name. */
    label: string;
    companyName: string;
    status: ProjectStatus;
    startDate: string | null;
    dueDate: string | null;
    completedAt: string | null;
    /** Kilograms — the assembly list's total once a list exists. */
    weightKg: number | null;
  };
  totals: ProjectReportTotals;
  byActivity: ProjectReportActivityRow[];
  byPerson: ProjectReportPersonRow[];
};

// ---------------------------------------------------------------------------
// Proiecte active — hours burned against pieces actually finished.
// ---------------------------------------------------------------------------

export type ActiveProjectStepRow = {
  activityId: string;
  activityName: string;
  color: string | null;
  workedMinutes: number;
  progress: AssemblyStepProgress;
  /**
   * 0–100 by kilograms, or by pieces when the list carries no weights. Can
   * exceed 100 when more pieces were reported than the list holds — the shop
   * floor is usually right and the list stale, so it is shown, not clamped.
   */
  progressPct: number;
};

export type ActiveProjectRow = {
  id: string;
  code: string;
  label: string;
  companyName: string;
  status: ProjectStatus;
  dueDate: string | null;
  /** Calendar days left until the deadline; negative once it has passed. */
  daysToDue: number | null;
  workedMinutes: number;
  estimatedMinutes: number | null;
  /** worked / estimated × 100; null without an estimate. */
  hoursPct: number | null;
  /**
   * Physical completion: the mean of the steps in play, each capped at 100.
   * Null when the project has no assembly list to measure against.
   */
  physicalPct: number | null;
  /** hoursPct − physicalPct. Positive means hours are running ahead of work. */
  gapPct: number | null;
  steps: ActiveProjectStepRow[];
};

export type ActiveProjectsReportResponse = {
  rows: ActiveProjectRow[];
  /** ISO timestamp — the report is a snapshot of now, not of an interval. */
  generatedAt: string;
};

// ---------------------------------------------------------------------------
// Normative — hours per ton, per activity, from the projects already delivered.
// ---------------------------------------------------------------------------

export type ActivityNormRow = {
  activityId: string | null;
  activityName: string;
  color: string | null;
  /** Delivered projects behind this row. */
  projectCount: number;
  workedMinutes: number;
  /** Σ hours / Σ tons over the whole window — the figure to quote with. */
  pooledHoursPerTon: number;
  /** The middle project and the quartiles around it — how much it varies. */
  medianHoursPerTon: number;
  p25HoursPerTon: number;
  p75HoursPerTon: number;
};

export type ActivityNormsResponse = {
  /** Resolved window, inclusive, as `YYYY-MM-DD` calendar days. */
  from: string;
  to: string;
  months: number;
  projectCount: number;
  totalTons: number;
  totalWorkedMinutes: number;
  /** Across every activity — the norm for a whole structure. */
  pooledHoursPerTon: number | null;
  medianHoursPerTon: number | null;
  activities: ActivityNormRow[];
  /** Delivered projects left out because they carry no weight. */
  skippedWithoutWeight: number;
};
