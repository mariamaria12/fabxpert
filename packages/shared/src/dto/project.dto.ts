import { z } from 'zod';

export const PROJECT_STATUS_VALUES = [
  'CIORNA',
  'IN_OFERTARE',
  'CASTIGAT',
  'IN_PROIECTARE',
  'IN_PRODUCTIE',
  'PREGATIT_LIVRARE',
  'LIVRAT',
  'FINALIZAT',
  'SUSPENDAT',
  'ANULAT',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUS_VALUES)[number];

export type ProjectStatusGroup = 'in_progress' | 'completed';

export const PROJECT_LIST_SORT_BY_VALUES = [
  'name',
  'code',
  'company',
  'startDate',
  'dueDate',
] as const;

export type ProjectListSortBy = (typeof PROJECT_LIST_SORT_BY_VALUES)[number];

export const SORT_ORDER_VALUES = ['asc', 'desc'] as const;

export type SortOrder = (typeof SORT_ORDER_VALUES)[number];

const projectStatusSchema = z.enum(PROJECT_STATUS_VALUES);

const companyIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

const roleIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex value in the form #RRGGBB');

const visibleForRoleIdsSchema = z.array(roleIdSchema);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  code: z.string().trim().min(1, 'Code is required'),
  companyId: companyIdSchema,
  status: projectStatusSchema.optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  readyForExecution: z.boolean().optional(),
  color: hexColorSchema.optional(),
  /** Omitted or [] = visible to all employees. */
  visibleForRoleIds: visibleForRoleIdsSchema.optional(),
});

export const updateProjectSchema = createProjectSchema
  .extend({
    color: z.union([hexColorSchema, z.null()]).optional(),
  })
  .partial()
  .refine(
  (data) => data.name === undefined || data.name.trim().length > 0,
  { message: 'Name cannot be empty', path: ['name'] },
).refine(
  (data) => data.code === undefined || data.code.trim().length > 0,
  { message: 'Code cannot be empty', path: ['code'] },
);

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export type ProjectCompanyDto = {
  id: string;
  name: string;
};

export type ProjectVisibleRoleDto = {
  id: string;
  name: string;
};

/** API-facing Project shape — deletedAt is an internal implementation detail. */
export type ProjectDto = {
  id: string;
  name: string;
  code: string;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  readyForExecution: boolean;
  color: string | null;
  companyId: string;
  company: ProjectCompanyDto;
  /** Empty = visible to all employees with readyForExecution. */
  visibleForRoles: ProjectVisibleRoleDto[];
  createdAt: string;
  updatedAt: string;
};

/** Reduced shape for employee project selection (mobile dropdown). */
export type ProjectOptionDto = {
  id: string;
  name: string;
  code: string;
  color: string | null;
};
