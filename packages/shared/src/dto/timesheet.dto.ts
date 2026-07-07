import { z } from 'zod';

/** UUID-like id (accepts seed person ids with `p` prefix). */
const uuidSchema = z
  .string()
  .regex(
    /^([0-9a-f]{8}|p[0-9a-f]{7})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

const optionalNotes = z.string().optional();

export const startTimesheetSchema = z.object({
  projectId: uuidSchema,
  activityId: uuidSchema.optional(),
  notes: optionalNotes,
});

/** Superset for start/stop — personId is validated in the service (ADMIN only). */
export const startTimesheetBodySchema = startTimesheetSchema.extend({
  personId: uuidSchema.optional(),
});

export const stopTimesheetSchema = z.object({
  personId: uuidSchema.optional(),
});

export const createTimesheetSchema = z.object({
  projectId: uuidSchema,
  activityId: uuidSchema.optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date().optional(),
  notes: optionalNotes,
  personId: uuidSchema.optional(),
});

export const updateTimesheetSchema = z
  .object({
    projectId: uuidSchema.optional(),
    activityId: uuidSchema.optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    notes: optionalNotes,
    personId: uuidSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type StartTimesheetInput = z.infer<typeof startTimesheetSchema>;
export type StartTimesheetBodyInput = z.infer<typeof startTimesheetBodySchema>;
export type StopTimesheetInput = z.infer<typeof stopTimesheetSchema>;
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
  startTime: string;
  endTime: string | null;
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

export type ProjectSummaryPeriod = 'all' | 'month' | 'week';

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
  period: ProjectSummaryPeriod;
  projects: ProjectSummaryProjectRow[];
};
