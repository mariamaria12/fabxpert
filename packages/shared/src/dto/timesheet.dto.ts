import { z } from 'zod';
import type { ProjectStatus, ProjectVisibleRoleDto } from './project.dto';

/** UUID-like id (accepts seed person ids with `p` prefix). */
const uuidSchema = z
  .string()
  .regex(
    /^([0-9a-f]{8}|p[0-9a-f]{7})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

const optionalNotes = z.string().optional();

const durationMinutesSchema = z.number().int().positive();

const workDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'workDate must be YYYY-MM-DD');

/**
 * Which assemblies this entry covered, and how many pieces of each. Only
 * meaningful together with an activity — progress is reported per activity.
 */
export const timesheetAssemblyInputSchema = z.object({
  assemblyId: uuidSchema,
  quantityDone: z.number().int().positive(),
});

const assembliesSchema = z.array(timesheetAssemblyInputSchema);

export const createTimesheetSchema = z.object({
  projectId: uuidSchema,
  activityId: uuidSchema.optional(),
  workDate: workDateSchema.optional(),
  durationMinutes: durationMinutesSchema,
  notes: optionalNotes,
  personId: uuidSchema.optional(),
  assemblies: assembliesSchema.optional(),
});

export const updateTimesheetSchema = z
  .object({
    projectId: uuidSchema.optional(),
    activityId: uuidSchema.optional(),
    workDate: workDateSchema.optional(),
    durationMinutes: durationMinutesSchema.optional(),
    notes: optionalNotes,
    personId: uuidSchema.optional(),
    /** Replaces the whole set for this entry; [] clears it. */
    assemblies: assembliesSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateTimesheetInput = z.infer<typeof createTimesheetSchema>;
export type UpdateTimesheetInput = z.infer<typeof updateTimesheetSchema>;
export type TimesheetAssemblyInput = z.infer<typeof timesheetAssemblyInputSchema>;

export type TimesheetPersonDto = {
  id: string;
  firstName: string;
  lastName: string;
};

export type TimesheetProjectDto = {
  id: string;
  name: string;
  code: string;
  denumireLucrare: string | null;
  color: string | null;
  company: {
    name: string;
  };
};

export type TimesheetActivityDto = {
  id: string;
  name: string;
  color: string | null;
};

/** One assembly this entry covered, with the pieces reported against it. */
export type TimesheetAssemblyDto = {
  assemblyId: string;
  name: string;
  quantityDone: number;
};

export type TimesheetDto = {
  id: string;
  workDate: string;
  durationMinutes: number;
  notes: string | null;
  personId: string;
  userId: string;
  projectId: string;
  activityId: string | null;
  person: TimesheetPersonDto;
  project: TimesheetProjectDto;
  activity: TimesheetActivityDto | null;
  /** Empty when the entry's activity does not track assemblies. */
  assemblies: TimesheetAssemblyDto[];
  createdAt: string;
  updatedAt: string;
};

/** Per-activity total inside one person-day group. */
export type TimesheetDayGroupActivityDto = {
  activityId: string | null;
  activityName: string;
  activityColor: string | null;
  minutes: number;
};

/** Everything one person logged on one day — the row shape of the Pontaje list. */
export type TimesheetDayGroupDto = {
  /** `${personId}:${yyyy-mm-dd}`, stable across refetches. */
  id: string;
  workDate: string;
  person: TimesheetPersonDto;
  entryCount: number;
  totalMinutes: number;
  /** The day's entries, oldest first. */
  entries: TimesheetDto[];
  /** Longest first. */
  activityTotals: TimesheetDayGroupActivityDto[];
};

export const TIMESHEET_GROUP_SORT_BY_VALUES = [
  'date',
  'person',
  'entries',
  'duration',
] as const;

export type TimesheetGroupSortBy = (typeof TIMESHEET_GROUP_SORT_BY_VALUES)[number];

export type TimesheetSummaryPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';

/** @deprecated Use TimesheetSummaryPeriod — kept as alias for project-summary responses */
export type ProjectSummaryPeriod = TimesheetSummaryPeriod;

export type ProjectSummaryActivityRow = {
  activityId: string | null;
  activityName: string;
  activityColor: string | null;
  minutes: number;
};

export type ProjectSummaryProjectRow = {
  id: string;
  name: string;
  denumireLucrare: string | null;
  finisaj: string | null;
  code: string;
  color: string | null;
  status: ProjectStatus;
  company: { id: string; name: string };
  totalMinutes: number;
  activities: ProjectSummaryActivityRow[];
};

export type ProjectSummaryResponse = {
  period: TimesheetSummaryPeriod;
  projects: ProjectSummaryProjectRow[];
};

export type PinnedProjectSummaryRow = {
  id: string;
  name: string;
  denumireLucrare: string | null;
  finisaj: string | null;
  code: string;
  color: string | null;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  indexPanou: number | null;
  panouColumn: number | null;
  readyForExecution: boolean;
  company: { id: string; name: string };
  visibleForRoles: ProjectVisibleRoleDto[];
  totalMinutes: number;
  activities: ProjectSummaryActivityRow[];
};

export type PinnedProjectsSummaryResponse = {
  projects: PinnedProjectSummaryRow[];
};

export type PersonSummaryActivityRow = {
  projectId: string;
  projectName: string;
  projectCode: string;
  projectDenumireLucrare: string | null;
  companyName: string;
  projectColor: string | null;
  projectStatus: ProjectStatus;
  activityId: string | null;
  activityName: string;
  activityColor: string | null;
  minutes: number;
  /** Notes typed on the timesheets behind this total; empty when there are none. */
  notes: string[];
};

export type PersonSummaryPersonRow = {
  id: string;
  firstName: string;
  lastName: string;
  group: PersonAccountGroup;
  totalMinutes: number;
  activities: PersonSummaryActivityRow[];
};

export type PersonSummaryResponse = {
  period: TimesheetSummaryPeriod;
  persons: PersonSummaryPersonRow[];
};

/**
 * 'external' = linked account has "Vede doar proiecte alocate specific"
 * (User.restrictedProjects). Everyone else is 'employee', including persons
 * with no account at all.
 */
export type PersonAccountGroup = 'employee' | 'external';

export type NotLoggedPersonRow = {
  id: string;
  firstName: string;
  lastName: string;
  employeeRoleName: string | null;
  group: PersonAccountGroup;
};

export type NotLoggedResponse = {
  period: TimesheetSummaryPeriod;
  persons: NotLoggedPersonRow[];
};

/** Every count except the project one is scoped to the requested period. */
export type DashboardMetricsResponse = {
  period: TimesheetSummaryPeriod;
  /** Live project status — not period-scoped. */
  inProgressProjectCount: number;
  totalMinutes: number;
  /** Persons with logged time in the period; their hours are `totalMinutes`. */
  distinctPersonCount: number;
  /** Distinct persons with an approved leave request overlapping the period. */
  onLeaveCount: number;
  /**
   * Persons with no logged time in the period, excluding admin accounts and
   * anyone on approved leave.
   */
  notLoggedPersonCount: number;
};

export type TimesheetSummaryParams = {
  period?: TimesheetSummaryPeriod;
  from?: string;
  to?: string;
};

export const TIMESHEET_LIST_SORT_BY_VALUES = [
  'person',
  'project',
  'activity',
  'date',
] as const;

export type TimesheetListSortBy = (typeof TIMESHEET_LIST_SORT_BY_VALUES)[number];
