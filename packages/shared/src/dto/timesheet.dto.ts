import { z } from 'zod';
import type { ProjectStatus } from './project.dto';

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

export const createTimesheetSchema = z.object({
  projectId: uuidSchema,
  activityId: uuidSchema.optional(),
  workDate: workDateSchema.optional(),
  durationMinutes: durationMinutesSchema,
  notes: optionalNotes,
  personId: uuidSchema.optional(),
});

export const updateTimesheetSchema = z
  .object({
    projectId: uuidSchema.optional(),
    activityId: uuidSchema.optional(),
    workDate: workDateSchema.optional(),
    durationMinutes: durationMinutesSchema.optional(),
    notes: optionalNotes,
    personId: uuidSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateTimesheetInput = z.infer<typeof createTimesheetSchema>;
export type UpdateTimesheetInput = z.infer<typeof updateTimesheetSchema>;

export type TimesheetPersonDto = {
  id: string;
  firstName: string;
  lastName: string;
};

export type TimesheetProjectDto = {
  id: string;
  name: string;
  code: string;
  color: string | null;
};

export type TimesheetActivityDto = {
  id: string;
  name: string;
  color: string | null;
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
  createdAt: string;
  updatedAt: string;
};

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
  code: string;
  color: string | null;
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
  code: string;
  color: string | null;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  company: { id: string; name: string };
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
  projectColor: string | null;
  activityId: string | null;
  activityName: string;
  activityColor: string | null;
  minutes: number;
};

export type PersonSummaryPersonRow = {
  id: string;
  firstName: string;
  lastName: string;
  totalMinutes: number;
  activities: PersonSummaryActivityRow[];
};

export type PersonSummaryResponse = {
  period: TimesheetSummaryPeriod;
  persons: PersonSummaryPersonRow[];
};

export type DashboardMetricsResponse = {
  inProgressProjectCount: number;
  todayTotalMinutes: number;
  todayDistinctPersonCount: number;
  /** Distinct persons with an approved leave request covering today. */
  todayOnLeaveCount: number;
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
